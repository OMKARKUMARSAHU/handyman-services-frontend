import { testAgent } from "../helpers/testApp";
import { resetDatabase } from "../helpers/db";
import { bearer, mintToken } from "../helpers/cognitoTestKit";

/**
 * PHASE_3 brief — AUTH scenarios: JWT signature, issuer, audience, expiry,
 * and role-claim checks all run through the REAL `authenticate()` middleware
 * and the REAL `aws-jwt-verify` verifier (see tests/helpers/cognitoTestKit.ts
 * for how signatures are genuinely verified without real AWS).
 */
describe("authentication", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("rejects a request with no Authorization header", async () => {
    const res = await testAgent().get("/api/v1/customer/me");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects a malformed Authorization header (not a Bearer token)", async () => {
    const res = await testAgent().get("/api/v1/customer/me").set("Authorization", "Basic abc123");
    expect(res.status).toBe(401);
  });

  it("rejects a token signed with the wrong private key", async () => {
    const token = mintToken({ role: "customer", useWrongKey: true });
    const res = await testAgent().get("/api/v1/customer/me").set("Authorization", bearer(token));
    expect(res.status).toBe(401);
  });

  it("rejects an expired token", async () => {
    const token = mintToken({ role: "customer", expiresInSeconds: -10 });
    const res = await testAgent().get("/api/v1/customer/me").set("Authorization", bearer(token));
    expect(res.status).toBe(401);
  });

  it("rejects a token with an unrecognized issuer", async () => {
    const token = mintToken({ role: "customer", issuer: "https://cognito-idp.ap-south-1.amazonaws.com/not-the-pool" });
    const res = await testAgent().get("/api/v1/customer/me").set("Authorization", bearer(token));
    expect(res.status).toBe(401);
  });

  it("rejects a token whose client_id is not one of the configured app clients", async () => {
    const token = mintToken({ role: "customer", clientId: "some-other-app-client" });
    const res = await testAgent().get("/api/v1/customer/me").set("Authorization", bearer(token));
    expect(res.status).toBe(401);
  });

  it("rejects a valid, correctly-signed token that carries no recognized role group", async () => {
    const token = mintToken({ groups: ["not-a-real-role"] });
    const res = await testAgent().get("/api/v1/customer/me").set("Authorization", bearer(token));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("accepts a genuinely valid customer token and just-in-time provisions the local customer row", async () => {
    const token = mintToken({ role: "customer" });
    const res = await testAgent().get("/api/v1/customer/me").set("Authorization", bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.accountStatus).toBe("active");
    expect(typeof res.body.data.id).toBe("string");
  });
});
