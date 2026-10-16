import { DeleteObjectCommand } from "@aws-sdk/client-s3";

// DB-free test of deleteMedia: an in-memory table store stands in for knex, S3 is a mock.
type Row = Record<string, unknown>;
const store: Record<string, Row[]> = {};
const sendMock = jest.fn();

class FakeQuery implements PromiseLike<unknown> {
  private conds: Array<[string, unknown]> = [];
  private mode: "select" | "delete" = "select";
  constructor(private table: string) {}
  select() { return this; }
  join() { return this; }
  whereNotNull() { return this; }
  where(a: string | Row, b?: unknown) {
    if (typeof a === "string") this.conds.push([a.split(".").pop()!, b]);
    else for (const [k, v] of Object.entries(a)) this.conds.push([k, v]);
    return this;
  }
  delete() { this.mode = "delete"; return this; }
  first() { return Promise.resolve(this.rows()[0]); }
  private rows() {
    const base = (store[this.table.split(" as ")[0]!] ?? []);
    return base.filter((r) => this.conds.every(([k, v]) => r[k] === v));
  }
  then<T1, T2>(res?: (v: unknown) => T1 | PromiseLike<T1>, rej?: (e: unknown) => T2 | PromiseLike<T2>) {
    if (this.mode === "delete") {
      const doomed = new Set(this.rows());
      store[this.table] = (store[this.table] ?? []).filter((r) => !doomed.has(r));
      return Promise.resolve(doomed.size).then(res, rej);
    }
    return Promise.resolve(this.rows()).then(res, rej);
  }
}

jest.mock("../../src/database/db", () => ({
  getDb: () => (table: string) => new FakeQuery(table),
  closeDb: async () => undefined,
}));
jest.mock("../../src/modules/media/media.service", () => ({
  ...jest.requireActual("../../src/modules/media/media.service"),
  getS3Client: () => ({ send: sendMock }),
  requireBucketName: () => "test-bucket",
}));
const warnMock = jest.fn();
jest.mock("../../src/shared/logger", () => ({ logger: { warn: (...a: unknown[]) => warnMock(...a), info: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { deleteMedia } from "../../src/modules/media-library/media-library.service";

const KEY = "library/image/11111111-2222-4333-8444-555555555555-test.png";
const URL_ = `/api/backend/media/file/${KEY}`;
const mediaRow = () => ({
  id: "m1", type: "image", s3_key: KEY, url: URL_, mime_type: "image/png", original_filename: "t.png",
  file_size_bytes: 10, title: null, seo_title: null, alt_text: null, description: null, active: true,
  created_at: new Date(), updated_at: new Date(),
});

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  store.media = [mediaRow()];
  sendMock.mockReset();
  sendMock.mockResolvedValue({});
  warnMock.mockReset();
});

describe("deleteMedia", () => {
  it("deletes the row and the S3 object using the row's own s3_key", async () => {
    await deleteMedia("m1");
    expect(store.media).toHaveLength(0);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const cmd = sendMock.mock.calls[0]![0] as DeleteObjectCommand;
    expect(cmd).toBeInstanceOf(DeleteObjectCommand);
    expect(cmd.input).toEqual({ Bucket: "test-bucket", Key: KEY });
  });

  it.each([
    ["products", "image"],
    ["categories", "image"],
    ["cities", "icon_url"],
  ])("refuses with 409 and changes nothing when %s.%s equals media.url", async (table, column) => {
    store[table] = [{ id: "x1", name: "Used", [column]: URL_ }];
    await expect(deleteMedia("m1")).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
    expect(store.media).toHaveLength(1);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("a stored absolute variant would NOT match (why the schema canonicalises it)", async () => {
    store.products = [{ id: "x1", name: "Abs", image: `https://www.growthnova.co.in${URL_}` }];
    await deleteMedia("m1"); // documents the gap the canonicalising mediaUrlSchema closes
    expect(store.media).toHaveLength(0);
  });

  it("an S3 failure is logged, does not throw, and leaves no row pointing at a missing object", async () => {
    sendMock.mockRejectedValue(new Error("AccessDenied"));
    await expect(deleteMedia("m1")).resolves.toBeUndefined();
    expect(store.media).toHaveLength(0);
    expect(warnMock).toHaveBeenCalledWith(expect.objectContaining({ mediaId: "m1", s3Key: KEY }), "media_s3_delete_failed");
  });

  it("a malformed s3_key skips S3 and logs", async () => {
    store.media = [{ ...mediaRow(), s3_key: "../evil" }];
    await deleteMedia("m1");
    expect(sendMock).not.toHaveBeenCalled();
    expect(warnMock).toHaveBeenCalled();
  });

  it("404s for an unknown id", async () => {
    await expect(deleteMedia("nope")).rejects.toMatchObject({ status: 404 });
  });
});
