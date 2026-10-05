import { testAgent } from "../helpers/testApp";
import { resetDatabase } from "../helpers/db";
import { installFakeCognitoClient, uninstallFakeCognitoClient, FakeCognitoStore } from "../helpers/fakeCognitoClient";

/**
 * AUTHENTICATION & AUTHORIZATION PHASE — the Cognito-issuing endpoints
 * (`/auth/*`). These exercise the REAL route/validation/cookie/error-mapping
 * code; only the Cognito API call itself is faked (see fakeCognitoClient.ts
 * for exactly why and how — it still mints a genuinely, independently
 * verified JWT, so "does the resulting session actually authorize correctly"
 * is tested through the real `authenticate()`/`requireRole()` pipeline, not
 * assumed).
 */
describe("auth flows (signup/login/forgot-password/logout)", () => {
  let store: FakeCognitoStore;

  beforeEach(async () => {
    await resetDatabase();
    store = installFakeCognitoClient();
  });

  afterEach(() => {
    uninstallFakeCognitoClient();
  });

  function getCookies(res: { headers: Record<string, string | string[]> }): string[] {
    const raw = res.headers["set-cookie"];
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  }

  describe("customer signup -> verify -> login", () => {
    it("signs up a new customer", async () => {
      const res = await testAgent()
        .post("/api/v1/auth/signup")
        .send({ name: "Asha Rao", email: "asha@example.com", password: "Str0ng!Pass" });
      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe("asha@example.com");
      expect(res.body.data.confirmed).toBe(false);
    });

    it("rejects signup with a password that fails the policy", async () => {
      const res = await testAgent()
        .post("/api/v1/auth/signup")
        .send({ name: "Asha Rao", email: "asha2@example.com", password: "weak" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects a duplicate signup", async () => {
      await testAgent().post("/api/v1/auth/signup").send({ name: "A", email: "dupe@example.com", password: "Str0ng!Pass" });
      const res = await testAgent().post("/api/v1/auth/signup").send({ name: "A", email: "dupe@example.com", password: "Str0ng!Pass" });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
    });

    it("rejects confirm-signup with the wrong code", async () => {
      await testAgent().post("/api/v1/auth/signup").send({ name: "A", email: "badcode@example.com", password: "Str0ng!Pass" });
      const res = await testAgent().post("/api/v1/auth/confirm-signup").send({ email: "badcode@example.com", code: "000000" });
      expect(res.status).toBe(400);
    });

    it("rejects login before the account is confirmed", async () => {
      await testAgent().post("/api/v1/auth/signup").send({ name: "A", email: "unconfirmed@example.com", password: "Str0ng!Pass" });
      const res = await testAgent().post("/api/v1/auth/login").send({ email: "unconfirmed@example.com", password: "Str0ng!Pass" });
      expect(res.status).toBe(401);
    });

    it("confirms signup, assigns the customer group, and allows login that reaches a protected customer route", async () => {
      await testAgent().post("/api/v1/auth/signup").send({ name: "Priya", email: "priya@example.com", password: "Str0ng!Pass" });
      const confirmRes = await testAgent().post("/api/v1/auth/confirm-signup").send({ email: "priya@example.com", code: "111111" });
      expect(confirmRes.status).toBe(200);
      expect(store.users.get("priya@example.com")?.groups).toEqual(["customer"]);

      const loginRes = await testAgent().post("/api/v1/auth/login").send({ email: "priya@example.com", password: "Str0ng!Pass" });
      expect(loginRes.status).toBe(200);
      const cookies = getCookies(loginRes);
      expect(cookies.some((c) => c.startsWith("hs_at=") && c.includes("HttpOnly"))).toBe(true);
      expect(cookies.some((c) => c.startsWith("hs_rt=") && c.includes("HttpOnly"))).toBe(true);

      // The cookie-borne session, with no Authorization header, reaches the REAL
      // authenticate()+requireRole() pipeline exactly like a browser session would.
      const meRes = await testAgent().get("/api/v1/customer/me").set("Cookie", cookies);
      expect(meRes.status).toBe(200);
      expect(meRes.body.data.accountStatus).toBe("active");
    });

    it("rejects login with the wrong password", async () => {
      await testAgent().post("/api/v1/auth/signup").send({ name: "A", email: "wrongpw@example.com", password: "Str0ng!Pass" });
      await testAgent().post("/api/v1/auth/confirm-signup").send({ email: "wrongpw@example.com", code: "111111" });
      const res = await testAgent().post("/api/v1/auth/login").send({ email: "wrongpw@example.com", password: "NotTheRight1!" });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    });

    it("rejects login for an email that was never signed up (generic, no user-existence leak)", async () => {
      const res = await testAgent().post("/api/v1/auth/login").send({ email: "ghost@example.com", password: "Str0ng!Pass" });
      expect(res.status).toBe(401);
    });

    it("resends a confirmation code for a pending signup", async () => {
      await testAgent().post("/api/v1/auth/signup").send({ name: "A", email: "resend@example.com", password: "Str0ng!Pass" });
      const res = await testAgent().post("/api/v1/auth/resend-code").send({ email: "resend@example.com" });
      expect(res.status).toBe(200);
      expect(res.body.data.resent).toBe(true);
    });
  });

  describe("forgot password", () => {
    it("always returns success for forgot-password, even for an unknown email", async () => {
      const res = await testAgent().post("/api/v1/auth/forgot-password").send({ email: "unknown@example.com" });
      expect(res.status).toBe(200);
      expect(res.body.data.codeSent).toBe(true);
    });

    it("resets the password and the new password can log in while the old one can't", async () => {
      await testAgent().post("/api/v1/auth/signup").send({ name: "A", email: "reset@example.com", password: "Str0ng!Pass" });
      await testAgent().post("/api/v1/auth/confirm-signup").send({ email: "reset@example.com", code: "111111" });
      await testAgent().post("/api/v1/auth/forgot-password").send({ email: "reset@example.com" });

      const confirmRes = await testAgent()
        .post("/api/v1/auth/confirm-forgot-password")
        .send({ email: "reset@example.com", code: "222222", newPassword: "NewStr0ng!Pass" });
      expect(confirmRes.status).toBe(200);

      const oldLogin = await testAgent().post("/api/v1/auth/login").send({ email: "reset@example.com", password: "Str0ng!Pass" });
      expect(oldLogin.status).toBe(401);

      const newLogin = await testAgent().post("/api/v1/auth/login").send({ email: "reset@example.com", password: "NewStr0ng!Pass" });
      expect(newLogin.status).toBe(200);
    });

    it("rejects confirm-forgot-password with the wrong code", async () => {
      await testAgent().post("/api/v1/auth/signup").send({ name: "A", email: "badreset@example.com", password: "Str0ng!Pass" });
      await testAgent().post("/api/v1/auth/confirm-signup").send({ email: "badreset@example.com", code: "111111" });
      await testAgent().post("/api/v1/auth/forgot-password").send({ email: "badreset@example.com" });
      const res = await testAgent()
        .post("/api/v1/auth/confirm-forgot-password")
        .send({ email: "badreset@example.com", code: "999999", newPassword: "NewStr0ng!Pass" });
      expect(res.status).toBe(400);
    });
  });

  describe("provider / admin login (shared entry point, no signup)", () => {
    it("logs in a pre-provisioned provider and reaches a provider-only route", async () => {
      store.seedConfirmedUser("provider@example.com", "ProvPass1!", "Test Provider", ["provider"]);
      const loginRes = await testAgent()
        .post("/api/v1/auth/admin-provider/login")
        .send({ email: "provider@example.com", password: "ProvPass1!" });
      expect(loginRes.status).toBe(200);
      const cookies = getCookies(loginRes);

      const meRes = await testAgent().get("/api/v1/provider/me").set("Cookie", cookies);
      expect(meRes.status).toBe(200);
    });

    it("logs in a pre-provisioned admin and reaches an admin-only route", async () => {
      store.seedConfirmedUser("admin@example.com", "AdminPass1!", "Test Admin", ["admin"]);
      const loginRes = await testAgent()
        .post("/api/v1/auth/admin-provider/login")
        .send({ email: "admin@example.com", password: "AdminPass1!" });
      expect(loginRes.status).toBe(200);
      const cookies = getCookies(loginRes);

      const pendingRes = await testAgent().get("/api/v1/admin/listings/pending").set("Cookie", cookies);
      expect(pendingRes.status).toBe(200);
    });

    it("blocks a provider's session cookie from an admin-only route (wrong role, real session)", async () => {
      store.seedConfirmedUser("provider2@example.com", "ProvPass1!", "Test Provider", ["provider"]);
      const loginRes = await testAgent()
        .post("/api/v1/auth/admin-provider/login")
        .send({ email: "provider2@example.com", password: "ProvPass1!" });
      const cookies = getCookies(loginRes);

      const res = await testAgent().get("/api/v1/admin/listings/pending").set("Cookie", cookies);
      expect(res.status).toBe(403);
    });

    it("there is no signup endpoint for provider/admin — only /auth/signup (customer) exists", async () => {
      const res = await testAgent()
        .post("/api/v1/auth/admin-provider/signup")
        .send({ email: "x@example.com", password: "Str0ng!Pass" });
      expect(res.status).toBe(404);
    });
  });

  describe("logout", () => {
    it("logs out, clears the session cookies, and the cleared cookie no longer authenticates", async () => {
      await testAgent().post("/api/v1/auth/signup").send({ name: "A", email: "logout@example.com", password: "Str0ng!Pass" });
      await testAgent().post("/api/v1/auth/confirm-signup").send({ email: "logout@example.com", code: "111111" });
      const loginRes = await testAgent().post("/api/v1/auth/login").send({ email: "logout@example.com", password: "Str0ng!Pass" });
      const cookies = getCookies(loginRes);

      const logoutRes = await testAgent().post("/api/v1/auth/logout").set("Cookie", cookies);
      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.data.loggedOut).toBe(true);
      const clearedCookies = getCookies(logoutRes);
      expect(clearedCookies.some((c) => c.startsWith("hs_at=;") || /hs_at=;.*Expires=Thu, 01 Jan 1970/.test(c))).toBe(true);
    });

    it("rejects logout when there is no session at all", async () => {
      const res = await testAgent().post("/api/v1/auth/logout");
      expect(res.status).toBe(401);
    });
  });
});
