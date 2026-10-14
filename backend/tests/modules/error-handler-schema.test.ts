import type { Request, Response } from "express";
import { errorHandler } from "../../src/middleware/errorHandler";

function run(err: unknown) {
  const res = { statusCode: 0, body: undefined as unknown, status(c: number) { this.statusCode = c; return this; }, json(b: unknown) { this.body = b; return this; } };
  errorHandler()(err, { requestId: "r1" } as unknown as Request, res as unknown as Response, () => {});
  return res;
}

describe("errorHandler: database schema out of date", () => {
  it("maps ER_NO_SUCH_TABLE to a clear 503 without leaking SQL", () => {
    const res = run(Object.assign(new Error("Table 'handyman_dev.shop_categories' doesn't exist"), { code: "ER_NO_SUCH_TABLE", sql: "select * from shop_categories" }));
    expect(res.statusCode).toBe(503);
    const body = res.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe("DATABASE_NOT_MIGRATED");
    expect(JSON.stringify(body)).not.toMatch(/shop_categories|select \*/i);
  });
  it("maps ER_BAD_FIELD_ERROR the same way", () => {
    expect(run(Object.assign(new Error("Unknown column"), { code: "ER_BAD_FIELD_ERROR" })).statusCode).toBe(503);
  });
  it("still returns a generic 500 for other unexpected errors", () => {
    const res = run(new Error("boom"));
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: { code: string } }).error.code).toBe("INTERNAL_ERROR");
  });
});
