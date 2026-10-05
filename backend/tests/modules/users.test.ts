import { testAgent } from "../helpers/testApp";
import { resetDatabase } from "../helpers/db";
import { bearer, mintToken } from "../helpers/cognitoTestKit";

describe("generic /me", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns the customer shape for a customer token", async () => {
    const res = await testAgent().get("/api/v1/me").set("Authorization", bearer(mintToken({ role: "customer" })));
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("customer");
    expect(res.body.data.accountStatus).toBe("active");
  });

  it("returns the provider shape for a provider token", async () => {
    const res = await testAgent().get("/api/v1/me").set("Authorization", bearer(mintToken({ role: "provider" })));
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("provider");
  });

  it("returns a claims-derived shape for an admin token (no admins table backs it)", async () => {
    const res = await testAgent().get("/api/v1/me").set("Authorization", bearer(mintToken({ role: "admin" })));
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("admin");
    expect(typeof res.body.data.sub).toBe("string");
  });

  it("rejects an unauthenticated request", async () => {
    const res = await testAgent().get("/api/v1/me");
    expect(res.status).toBe(401);
  });
});
