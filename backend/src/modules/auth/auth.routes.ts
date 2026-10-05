import { Router } from "express";
import { asyncHandler } from "../../shared/asyncHandler";
import { ok, created } from "../../shared/response";
import { AppError, UnauthenticatedError } from "../../shared/errors";
import { validateBody } from "../../middleware/validate";
import {
  signupSchema,
  confirmSignupSchema,
  resendCodeSchema,
  loginSchema,
  completeNewPasswordSchema,
  forgotPasswordSchema,
  confirmForgotPasswordSchema,
  providerSignupSchema,
} from "./auth.schema";
import {
  signUpCustomer,
  confirmSignUpCustomer,
  resendConfirmationCodeCustomer,
  loginCustomer,
  loginAdminOrProvider,
  completeNewPasswordAdminOrProvider,
  forgotPasswordCustomer,
  confirmForgotPasswordCustomer,
  signUpProvider,
  confirmSignUpProvider,
  resendConfirmationCodeProvider,
  forgotPasswordAdminOrProvider,
  confirmForgotPasswordAdminOrProvider,
  globalSignOut,
} from "./cognito.service";
import { createProviderApplication } from "../providers/providers.service";
import { setAuthCookies, clearAuthCookies, readAccessTokenCookie } from "./cookies";

/**
 * AUTHENTICATION & AUTHORIZATION PHASE — the endpoints that ISSUE/REVOKE
 * Cognito tokens. Everything that merely CHECKS an already-issued token
 * (authenticate() + requireRole()/requireOwnership()) was already built in
 * Phase 3 and is untouched by this phase.
 *
 * Scope: Customer gets signup + email verification + login + forgot/reset
 * password + logout. Admin gets ONLY login (through the shared
 * `/auth/admin-provider/login` entry point) + forgot/reset password +
 * logout — there is deliberately no Admin signup endpoint anywhere (FINAL
 * AUTHENTICATION ARCHITECTURE §3/§14: operator-created accounts only).
 * Provider additionally gets self-service signup + email verification
 * (`/auth/provider/*`, §5) against the same Admin/Provider app client,
 * which always results in a PENDING_APPROVAL application — see
 * providers.service.ts#createProviderApplication.
 */
export function authRouter(): Router {
  const router = Router();

  router.post(
    "/auth/signup",
    validateBody(signupSchema),
    asyncHandler(async (req, res) => {
      const { userSub } = await signUpCustomer(req.body);
      created(res, { email: req.body.email, userSub, confirmed: false });
    })
  );

  router.post(
    "/auth/confirm-signup",
    validateBody(confirmSignupSchema),
    asyncHandler(async (req, res) => {
      await confirmSignUpCustomer(req.body);
      ok(res, { email: req.body.email, confirmed: true });
    })
  );

  router.post(
    "/auth/resend-code",
    validateBody(resendCodeSchema),
    asyncHandler(async (req, res) => {
      await resendConfirmationCodeCustomer(req.body);
      ok(res, { email: req.body.email, resent: true });
    })
  );

  router.post(
    "/auth/login",
    validateBody(loginSchema),
    asyncHandler(async (req, res) => {
      const result = await loginCustomer(req.body);
      // Customers are always self-signed-up (never AdminCreateUser), so this branch is
      // not reachable today — kept only so this route stays correct if that ever changes,
      // without ever silently reporting a correct temporary password as a wrong one.
      if (result.status === "new_password_required") {
        ok(res, { email: req.body.email, challenge: "NEW_PASSWORD_REQUIRED" as const, session: result.session });
        return;
      }
      setAuthCookies(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        accessTokenExpiresInSeconds: result.accessTokenExpiresInSeconds,
        clientType: result.clientType,
      });
      ok(res, { email: req.body.email });
    })
  );

  router.post(
    "/auth/admin-provider/login",
    validateBody(loginSchema),
    asyncHandler(async (req, res) => {
      const result = await loginAdminOrProvider(req.body);
      // An AdminCreateUser-provisioned account (Admin or Provider) that hasn't completed
      // its first-login password change lands here — no cookies are set yet, the caller
      // must call /auth/admin-provider/complete-new-password with this `session`.
      if (result.status === "new_password_required") {
        ok(res, { email: req.body.email, challenge: "NEW_PASSWORD_REQUIRED" as const, session: result.session });
        return;
      }
      setAuthCookies(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        accessTokenExpiresInSeconds: result.accessTokenExpiresInSeconds,
        clientType: result.clientType,
      });
      ok(res, { email: req.body.email });
    })
  );

  router.post(
    "/auth/admin-provider/complete-new-password",
    validateBody(completeNewPasswordSchema),
    asyncHandler(async (req, res) => {
      const result = await completeNewPasswordAdminOrProvider(req.body);
      setAuthCookies(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        accessTokenExpiresInSeconds: result.accessTokenExpiresInSeconds,
        clientType: result.clientType,
      });
      ok(res, { email: req.body.email });
    })
  );

  // --- Service Provider self-registration (FINAL AUTHENTICATION ARCHITECTURE §5) ---
  // Mirrors the Customer signup shape above, against the Admin/Provider app
  // client instead, and ALSO captures the marketplace-onboarding profile
  // (createProviderApplication) at signup time — see that function's own
  // comment for why it has to happen here rather than later on first login.

  router.post(
    "/auth/provider/signup",
    validateBody(providerSignupSchema),
    asyncHandler(async (req, res) => {
      const { userSub } = await signUpProvider({
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        password: req.body.password,
      });
      try {
        await createProviderApplication({
          cognitoSub: userSub,
          name: req.body.name,
          email: req.body.email,
          phone: req.body.phone,
          businessName: req.body.businessName,
          city: req.body.city,
          categories: req.body.categories,
          yearsExperience: req.body.yearsExperience,
          bio: req.body.bio,
          availability: req.body.availability,
        });
      } catch (err) {
        // Cognito account IS created at this point — same "don't imply total
        // failure, but be honest something needs attention" pattern as
        // confirmSignUpCustomer's own group-assignment failure handling.
        throw new AppError(
          502,
          "INTERNAL_ERROR",
          "Your account was created, but your application details could not be saved. Please contact support.",
          { cause: err instanceof Error ? err.name : String(err) }
        );
      }
      created(res, { email: req.body.email, confirmed: false });
    })
  );

  router.post(
    "/auth/provider/confirm-signup",
    validateBody(confirmSignupSchema),
    asyncHandler(async (req, res) => {
      await confirmSignUpProvider(req.body);
      ok(res, { email: req.body.email, confirmed: true });
    })
  );

  router.post(
    "/auth/provider/resend-code",
    validateBody(resendCodeSchema),
    asyncHandler(async (req, res) => {
      await resendConfirmationCodeProvider(req.body);
      ok(res, { email: req.body.email, resent: true });
    })
  );

  // --- Shared Admin/Provider forgot-password (FINAL AUTHENTICATION ARCHITECTURE §8) ---

  router.post(
    "/auth/admin-provider/forgot-password",
    validateBody(forgotPasswordSchema),
    asyncHandler(async (req, res) => {
      await forgotPasswordAdminOrProvider(req.body);
      ok(res, { email: req.body.email, codeSent: true });
    })
  );

  router.post(
    "/auth/admin-provider/confirm-forgot-password",
    validateBody(confirmForgotPasswordSchema),
    asyncHandler(async (req, res) => {
      await confirmForgotPasswordAdminOrProvider(req.body);
      ok(res, { email: req.body.email, reset: true });
    })
  );

  router.post(
    "/auth/forgot-password",
    validateBody(forgotPasswordSchema),
    asyncHandler(async (req, res) => {
      await forgotPasswordCustomer(req.body);
      // Deliberately the same success shape whether or not the email exists — the real
      // Cognito pool has PreventUserExistenceErrors enabled on both app clients for exactly
      // this reason (never let a caller learn which emails have accounts).
      ok(res, { email: req.body.email, codeSent: true });
    })
  );

  router.post(
    "/auth/confirm-forgot-password",
    validateBody(confirmForgotPasswordSchema),
    asyncHandler(async (req, res) => {
      await confirmForgotPasswordCustomer(req.body);
      ok(res, { email: req.body.email, reset: true });
    })
  );

  router.post(
    "/auth/logout",
    asyncHandler(async (req, res) => {
      const header = req.header("authorization") ?? req.header("Authorization");
      const headerToken = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : undefined;
      const token = headerToken || readAccessTokenCookie(req.cookies as Record<string, string> | undefined);

      if (!token) {
        clearAuthCookies(res);
        throw new UnauthenticatedError("No active session to log out of.");
      }

      const result = await globalSignOut(token);
      clearAuthCookies(res);
      ok(res, { loggedOut: true, cognitoRevoked: result.ok });
    })
  );

  return router;
}
