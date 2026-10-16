// Regression test: presigned PUT URLs must not carry a baked-in checksum, or S3
// rejects every real upload (the checksum is of an empty body, the file is
// only picked later in the browser). Pure unit test: signing is local, no
// network and no database are used.
process.env.S3_BUCKET_NAME = "test-bucket";
process.env.AWS_ACCESS_KEY_ID = "AKIAFAKEFAKEFAKEFAKE";
process.env.AWS_SECRET_ACCESS_KEY = "fakefakefakefakefakefakefakefakefakefake";

jest.mock("../../src/database/db", () => ({ getDb: () => () => ({}), closeDb: async () => undefined }));

import { createLibraryUploadUrl } from "../../src/modules/media-library/media-library.service";

describe("presigned library upload URL", () => {
  it("is a plain PUT URL: host-only signed headers and no checksum parameters", async () => {
    const { uploadUrl, key } = await createLibraryUploadUrl({
      fileName: "ac unit.webp",
      contentType: "image/webp",
      fileSizeBytes: 1234,
    });
    const url = new URL(uploadUrl);
    const names = [...url.searchParams.keys()].map((k) => k.toLowerCase());

    expect(key).toMatch(/^library\/image\/[0-9a-f-]{36}-ac_unit\.webp$/);
    expect(url.host).toMatch(/\.s3\.[a-z0-9-]+\.amazonaws\.com$/);
    expect(url.pathname).toBe(`/${key}`);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(names).not.toContain("x-amz-checksum-crc32");
    expect(names).not.toContain("x-amz-sdk-checksum-algorithm");
    expect(names.filter((n) => n.includes("checksum"))).toEqual([]);
  });
});
