import {
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GlobalSignOutCommand,
  AdminAddUserToGroupCommand,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { env } from "../../config/env";
import { AppError, ConflictError, ForbiddenError, UnauthenticatedError, ValidationError } from "../../shared/errors";
import { logger } from "../../shared/logger";
import { getCognitoClient } from "./cognito.client";
import { computeSecretHash } from "./secretHash";
import { getVerifier } from "./verifier";
import type { AuthClientType } from "./cookies";

/**
 * All real Cognito API calls the backend makes to ACT on behalf of a user
 * (as opposed to verifier.ts, which only verifies an already-issued token).
 *
 * Login uses Cognito's "USER_AUTH" flow (InitiateAuth -> PASSWORD challenge
 * -> RespondToAuthChallenge) rather than the simpler USER_PASSWORD_AUTH flow,
 * because the EXISTING Customer app client (which this phase's brief
 * forbids modifying) only has ALLOW_USER_AUTH/ALLOW_USER_SRP_AUTH/
 * ALLOW_REFRESH_TOKEN_AUTH enabled — not ALLOW_USER_PASSWORD_AUTH — verified
 * directly against the real pool via the AWS MCP connector. The pool's
 * SignInPolicy only allows "PASSWORD" as a first factor, so USER_AUTH with
 * PREFERRED_CHALLENGE=PASSWORD resolves in one challenge round-trip, with no
 * SRP math required. The new Admin/Provider app client was deliberately
 * created with the same flow so one code path serves both.
 */

interface AuthResult {
  accessToken: string;
  refreshToken?: string;
  idToken: string;
  accessTokenExpiresInSeconds: number;
}

/**
 * Outcome of a password-challenge attempt. An admin-created (AdminCreateUser-
 * provisioned) account starts in Cognito's FORCE_CHANGE_PASSWORD status; once the
 * temporary password is accepted, Cognito does not issue tokens — it returns a
 * NEW_PASSWORD_REQUIRED challenge instead (confirmed via AWS's own support docs:
 * "After the user signs in with the temporary password, the user receives a
 * NEW_PASSWORD_REQUIRED challenge"). That is a normal, expected outcome, not an
 * authentication failure, so it is modeled as a result variant here rather than
 * thrown as an error — the previous code treated any non-"PASSWORD" challenge as
 * `NotAuthorizedException`, which is exactly why a correct temporary password was
 * being reported back to the user as "Incorrect email or password."
 */
export type AuthOutcome =
  | ({ status: "authenticated" } & AuthResult)
  | { status: "new_password_required"; session: string };

function requireUserPoolId(): string {
  if (!env.COGNITO_USER_POOL_ID) {
    throw new Error("COGNITO_USER_POOL_ID is not configured.");
  }
  return env.COGNITO_USER_POOL_ID;
}

function requireCustomerClientId(): string {
  if (!env.COGNITO_CUSTOMER_APP_CLIENT_ID) {
    throw new Error("COGNITO_CUSTOMER_APP_CLIENT_ID is not configured.");
  }
  return env.COGNITO_CUSTOMER_APP_CLIENT_ID;
}

function requireAdminProviderClient(): { clientId: string; clientSecret: string } {
  if (!env.COGNITO_ADMIN_PROVIDER_APP_CLIENT_ID || !env.COGNITO_ADMIN_PROVIDER_APP_CLIENT_SECRET) {
    throw new Error(
      "COGNITO_ADMIN_PROVIDER_APP_CLIENT_ID / COGNITO_ADMIN_PROVIDER_APP_CLIENT_SECRET are not configured."
    );
  }
  return { clientId: env.COGNITO_ADMIN_PROVIDER_APP_CLIENT_ID, clientSecret: env.COGNITO_ADMIN_PROVIDER_APP_CLIENT_SECRET };
}

/** Maps a raw Cognito SDK exception to this backend's standard error envelope. Never leaks AWS internals to the client. */
export function mapCognitoError(err: unknown): AppError {
  const name = err instanceof Error ? err.name : "";
  const message = err instanceof Error ? err.message : "Authentication request failed.";
  // TEMPORARY diagnostic logging (ISSUE 1 investigation, admin login). Every Cognito SDK
  // exception's own `name`/`message` is a generic, stable description Cognito itself
  // defines ("Incorrect username or password.", "User does not exist.", etc.) — never a
  // password, token, access key, or client secret — so this is safe to leave on during
  // local debugging. Remove this call once the real cause is confirmed and resolved.
  logger.warn({ cognitoErrorName: name, cognitoErrorMessage: message }, "cognito_auth_error_raw");
  switch (name) {
    case "UsernameExistsException":
      return new ConflictError("An account with this email already exists.");
    case "NotAuthorizedException":
      // Cognito returns this both for "wrong password" and (with PreventUserExistenceErrors
      // enabled, which both app clients have) "no such user" — deliberately generic.
      return new UnauthenticatedError("Incorrect email or password.");
    case "UserNotConfirmedException":
      return new UnauthenticatedError("This account's email has not been verified yet. Check your inbox for the verification code.");
    case "UserNotFoundException":
      return new UnauthenticatedError("Incorrect email or password.");
    case "CodeMismatchException":
      return new ValidationError("That verification code is incorrect.");
    case "ExpiredCodeException":
      return new ValidationError("That verification code has expired. Request a new one.");
    case "InvalidPasswordException":
      return new ValidationError(message || "That password does not meet the required policy.");
    case "InvalidParameterException":
      return new ValidationError(message || "The request was invalid.");
    case "LimitExceededException":
    case "TooManyRequestsException":
    case "TooManyFailedAttemptsException":
      return new AppError(429, "RATE_LIMITED", "Too many attempts. Please wait and try again.");
    case "AliasExistsException":
      return new ConflictError("An account with this email already exists.");
    default:
      return new AppError(502, "INTERNAL_ERROR", "The authentication provider rejected this request.");
  }
}

// ---- Customer: self-service signup / verification / forgot-password ----

export async function signUpCustomer(input: { name: string; email: string; password: string }): Promise<{ userSub: string }> {
  const clientId = requireCustomerClientId();
  try {
    const resp = await getCognitoClient().send(
      new SignUpCommand({
        ClientId: clientId,
        Username: input.email,
        Password: input.password,
        UserAttributes: [
          { Name: "email", Value: input.email },
          { Name: "name", Value: input.name },
        ],
      })
    );
    return { userSub: resp.UserSub ?? "" };
  } catch (err) {
    throw mapCognitoError(err);
  }
}

/** Confirms the SignUp verification code, then assigns the new user to the `customer` Cognito group (Option B — no Lambda trigger). */
export async function confirmSignUpCustomer(input: { email: string; code: string }): Promise<void> {
  const clientId = requireCustomerClientId();
  try {
    await getCognitoClient().send(
      new ConfirmSignUpCommand({ ClientId: clientId, Username: input.email, ConfirmationCode: input.code })
    );
  } catch (err) {
    throw mapCognitoError(err);
  }
  try {
    await getCognitoClient().send(
      new AdminAddUserToGroupCommand({ UserPoolId: requireUserPoolId(), Username: input.email, GroupName: "customer" })
    );
  } catch (err) {
    // The account IS confirmed at this point (Cognito's own state) even if group-assignment
    // fails — surface this distinctly rather than implying signup itself failed, since a
    // retried ConfirmSignUp would now (correctly) report the code as already used.
    throw new AppError(
      502,
      "INTERNAL_ERROR",
      "Your email was verified, but your account role could not be assigned. Please contact support.",
      { cause: err instanceof Error ? err.name : String(err) }
    );
  }
}

export async function resendConfirmationCodeCustomer(input: { email: string }): Promise<void> {
  const clientId = requireCustomerClientId();
  try {
    await getCognitoClient().send(new ResendConfirmationCodeCommand({ ClientId: clientId, Username: input.email }));
  } catch (err) {
    throw mapCognitoError(err);
  }
}

export async function forgotPasswordCustomer(input: { email: string }): Promise<void> {
  const clientId = requireCustomerClientId();
  try {
    await getCognitoClient().send(new ForgotPasswordCommand({ ClientId: clientId, Username: input.email }));
  } catch (err) {
    throw mapCognitoError(err);
  }
}

export async function confirmForgotPasswordCustomer(input: { email: string; code: string; newPassword: string }): Promise<void> {
  const clientId = requireCustomerClientId();
  try {
    await getCognitoClient().send(
      new ConfirmForgotPasswordCommand({
        ClientId: clientId,
        Username: input.email,
        ConfirmationCode: input.code,
        Password: input.newPassword,
      })
    );
  } catch (err) {
    throw mapCognitoError(err);
  }
}

// ---- Login (shared "USER_AUTH" + PASSWORD-challenge implementation) ----

/**
 * ROOT CAUSE (ISSUE 1 — Admin login "Incorrect email or password" for a confirmed,
 * correctly-grouped admin user): confirmed directly in the Cognito Console — this
 * user pool's Admin/Provider accounts (created via AdminCreateUser / the Console's
 * "Create user" flow) end up with an auto-generated, opaque Cognito **Username**
 * (a UUID-like value) that is NOT the user's email — true for both the real admin
 * (`info@claritygrowthadvisory.in`) and `test-admin@handymanservices.test`. Email is
 * only ever a plain attribute on these accounts here, not a value Cognito will
 * resolve on its own when passed as the `USERNAME` parameter.
 *
 * Customer accounts never hit this: self-service `SignUpCommand` is called with
 * `Username: email` directly (see signUpCustomer above), so a Customer's real
 * Cognito Username literally IS their email string — `loginCustomer` below is
 * untouched by this fix and keeps working exactly as before.
 *
 * Fix: before authenticating an Admin/Provider login (or completing its
 * NEW_PASSWORD_REQUIRED challenge), resolve the user's real Cognito Username from
 * their email via `ListUsersCommand` (a plain attribute search — works regardless
 * of this pool's alias/username configuration, and requires no Cognito User Pool
 * config change), then use THAT resolved Username — never the email — as both the
 * `USERNAME` parameter and the "username" element of SECRET_HASH. AWS's own docs
 * confirm any sign-in attribute value is valid as the secret-hash username element,
 * but only once it's a value Cognito can actually resolve to this user — which,
 * for this pool's Admin/Provider accounts, the email alone is not. No frontend
 * change is needed: the browser still only ever sends/receives email.
 */
async function resolveAdminProviderUsername(email: string): Promise<string> {
  try {
    const escaped = email.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const resp = await getCognitoClient().send(
      new ListUsersCommand({
        UserPoolId: requireUserPoolId(),
        Filter: `email = "${escaped}"`,
        Limit: 1,
      })
    );
    const match = resp.Users?.[0];
    if (!match?.Username) {
      // Same generic shape as a real NotAuthorizedException — never reveal whether
      // an account with this email exists.
      throw Object.assign(new Error("No Cognito user found for this email."), { name: "UserNotFoundException" });
    }
    return match.Username;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw mapCognitoError(err);
  }
}

/**
 * CROSS-FLOW LOGIN GUARD (MASTER TASK — Bug 1/Bug 2): Cognito does not
 * restrict which app client a user can authenticate against based on their
 * group — an Admin's or Provider's email+password works perfectly well
 * through the CUSTOMER app client's InitiateAuth call, and a Customer's
 * credentials work through the Admin/Provider app client too. Before this
 * guard, `loginCustomer()`/`loginAdminOrProvider()` trusted whichever
 * endpoint the browser happened to call and set a session cookie for ANY
 * successfully-authenticated pool user — so an Admin typing their
 * credentials into the Customer `/login` form was silently signed in as
 * though they were a customer (wrong panel, and the one hard rule this
 * project has — "Customer login must never authenticate an Admin as a
 * Customer" — was being violated by Cognito's own default behavior, not by
 * anything the frontend did). Re-verifies the JUST-ISSUED access token with
 * the SAME verifier (`verifier.ts`) every other authenticated request on
 * this backend goes through — no parallel/duplicate role check — and
 * refuses to let the login succeed (no cookies are ever set, since this
 * throws before the caller gets a chance to call `setAuthCookies`) unless
 * the verified `cognito:groups` claim actually contains one of the roles
 * this login endpoint is for.
 */
async function assertAccessTokenRole(accessToken: string, allowedRoles: readonly string[], rejectionMessage: string): Promise<void> {
  let payload: Awaited<ReturnType<ReturnType<typeof getVerifier>["verify"]>>;
  try {
    payload = await getVerifier().verify(accessToken);
  } catch {
    // The token Cognito just issued failing OUR OWN verifier (same JWKS/issuer/
    // audience/expiry check as every other request) would mean a real
    // configuration problem, not a legitimate login — never let it through.
    throw new UnauthenticatedError("Incorrect email or password.");
  }
  const groups = Array.isArray(payload["cognito:groups"]) ? (payload["cognito:groups"] as unknown[]) : [];
  const ok = groups.some((g) => allowedRoles.includes(g as string));
  if (!ok) {
    throw new ForbiddenError(rejectionMessage);
  }
}

async function authenticateWithPassword(params: {
  clientId: string;
  clientSecret?: string;
  username: string;
  password: string;
}): Promise<AuthOutcome> {
  const { clientId, clientSecret, username, password } = params;
  const secretHash = clientSecret ? computeSecretHash(username, clientId, clientSecret) : undefined;

  try {
    const initiate = await getCognitoClient().send(
      new InitiateAuthCommand({
        AuthFlow: "USER_AUTH",
        ClientId: clientId,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
          PREFERRED_CHALLENGE: "PASSWORD",
          ...(secretHash ? { SECRET_HASH: secretHash } : {}),
        },
      })
    );

    // Cognito's choice-based USER_AUTH flow requires the preferred challenge's own
    // parameters in this SAME initial call (confirmed via AWS's own docs: requesting
    // PREFERRED_CHALLENGE of PASSWORD_SRP likewise requires SRP_A upfront) — so PASSWORD
    // must be sent here, not only in a later RespondToAuthChallenge. When everything is
    // configured correctly this resolves immediately without a challenge round-trip.
    if (initiate.AuthenticationResult) {
      const r = initiate.AuthenticationResult;
      if (!r.AccessToken || !r.IdToken || !r.ExpiresIn) throw new Error("Incomplete AuthenticationResult from Cognito.");
      return {
        status: "authenticated",
        accessToken: r.AccessToken,
        refreshToken: r.RefreshToken,
        idToken: r.IdToken,
        accessTokenExpiresInSeconds: r.ExpiresIn,
      };
    }

    // A correct TEMPORARY password (AdminCreateUser / AdminSetUserPassword with
    // Permanent=false) resolves here, not via AuthenticationResult — Cognito withholds
    // tokens until the permanent password is set. This is the exact case that used to
    // fall into the generic "Unexpected authentication challenge" branch below and get
    // reported as "Incorrect email or password."
    if (initiate.ChallengeName === "NEW_PASSWORD_REQUIRED") {
      if (!initiate.Session) {
        throw mapCognitoError(Object.assign(new Error("Missing session for NEW_PASSWORD_REQUIRED challenge."), { name: "NotAuthorizedException" }));
      }
      return { status: "new_password_required", session: initiate.Session };
    }

    if (initiate.ChallengeName !== "PASSWORD" || !initiate.Session) {
      // TEMPORARY diagnostic logging (ISSUE 1 investigation). The synthetic error thrown
      // below always reports as "NotAuthorizedException" to mapCognitoError, which would
      // otherwise hide the one fact that matters here: what Cognito's ChallengeName
      // actually was. Logs no secret — ChallengeName is a fixed Cognito enum value
      // ("PASSWORD", "SMS_MFA", "SELECT_CHALLENGE", ...), and `hasSession` is a boolean.
      logger.warn(
        { cognitoChallengeName: initiate.ChallengeName ?? null, hasSession: Boolean(initiate.Session) },
        "cognito_auth_unexpected_challenge"
      );
      throw mapCognitoError(Object.assign(new Error("Unexpected authentication challenge."), { name: "NotAuthorizedException" }));
    }

    const challengeResp = await getCognitoClient().send(
      new RespondToAuthChallengeCommand({
        ClientId: clientId,
        ChallengeName: "PASSWORD",
        Session: initiate.Session,
        ChallengeResponses: {
          USERNAME: username,
          PASSWORD: password,
          ...(secretHash ? { SECRET_HASH: secretHash } : {}),
        },
      })
    );

    if (!challengeResp.AuthenticationResult) {
      // Defensive — same reasoning as above, in case a future pool/client config ever
      // resolves PASSWORD via an explicit RespondToAuthChallenge round-trip instead of
      // inline on InitiateAuth.
      if (challengeResp.ChallengeName === "NEW_PASSWORD_REQUIRED" && challengeResp.Session) {
        return { status: "new_password_required", session: challengeResp.Session };
      }
      throw mapCognitoError(Object.assign(new Error("Incomplete AuthenticationResult from Cognito."), { name: "NotAuthorizedException" }));
    }
    const result = challengeResp.AuthenticationResult;
    if (!result.AccessToken || !result.IdToken || !result.ExpiresIn) {
      throw mapCognitoError(Object.assign(new Error("Incomplete AuthenticationResult from Cognito."), { name: "NotAuthorizedException" }));
    }
    return {
      status: "authenticated",
      accessToken: result.AccessToken,
      refreshToken: result.RefreshToken,
      idToken: result.IdToken,
      accessTokenExpiresInSeconds: result.ExpiresIn,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw mapCognitoError(err);
  }
}

export async function loginCustomer(input: { email: string; password: string }): Promise<AuthOutcome & { clientType: AuthClientType }> {
  const clientId = requireCustomerClientId();
  const outcome = await authenticateWithPassword({ clientId, username: input.email, password: input.password });
  if (outcome.status === "authenticated") {
    await assertAccessTokenRole(
      outcome.accessToken,
      ["customer"],
      "This is a Staff (Admin or Service Provider) account. Please sign in from the Staff Login page instead."
    );
  }
  return { ...outcome, clientType: "customer" };
}

/**
 * Shared Admin/Provider login entry point — role itself comes from the token's
 * `cognito:groups` claim once verified, never from which function the caller called.
 * Resolves the caller's email to this pool's real (opaque) Cognito Username first —
 * see the comment on `resolveAdminProviderUsername` above for why that's required
 * for Admin/Provider accounts specifically.
 */
export async function loginAdminOrProvider(input: { email: string; password: string }): Promise<AuthOutcome & { clientType: AuthClientType }> {
  const { clientId, clientSecret } = requireAdminProviderClient();
  const username = await resolveAdminProviderUsername(input.email);
  const outcome = await authenticateWithPassword({ clientId, clientSecret, username, password: input.password });
  if (outcome.status === "authenticated") {
    await assertAccessTokenRole(
      outcome.accessToken,
      ["admin", "provider"],
      "This is a Customer account. Please sign in from the Customer Login page instead."
    );
  }
  return { ...outcome, clientType: "adminProvider" };
}

/**
 * Completes an in-progress NEW_PASSWORD_REQUIRED challenge (the only way an
 * AdminCreateUser-provisioned account — Admin or Provider — can ever become a
 * normal, permanently-password'd account through this app, without this backend
 * ever setting or seeing that password itself). Customer accounts are always
 * self-signed-up (never AdminCreateUser) so they cannot reach FORCE_CHANGE_PASSWORD
 * in the current architecture; this is intentionally admin/provider-only.
 */
export async function completeNewPasswordAdminOrProvider(input: {
  email: string;
  session: string;
  newPassword: string;
}): Promise<AuthResult & { clientType: AuthClientType }> {
  const { clientId, clientSecret } = requireAdminProviderClient();
  // Must resolve to the SAME real Cognito Username that the original InitiateAuth
  // call (which produced this `session`) used — see resolveAdminProviderUsername's
  // comment above. The email→Username mapping is stable, so re-resolving here
  // (rather than threading the Username through the API response) keeps the
  // frontend/API contract unchanged — it still only ever deals in email.
  const username = await resolveAdminProviderUsername(input.email);
  const secretHash = computeSecretHash(username, clientId, clientSecret);
  try {
    const resp = await getCognitoClient().send(
      new RespondToAuthChallengeCommand({
        ClientId: clientId,
        ChallengeName: "NEW_PASSWORD_REQUIRED",
        Session: input.session,
        ChallengeResponses: {
          USERNAME: username,
          NEW_PASSWORD: input.newPassword,
          SECRET_HASH: secretHash,
        },
      })
    );
    const result = resp.AuthenticationResult;
    if (!result?.AccessToken || !result.IdToken || !result.ExpiresIn) {
      throw mapCognitoError(Object.assign(new Error("Incomplete AuthenticationResult from Cognito."), { name: "NotAuthorizedException" }));
    }
    await assertAccessTokenRole(
      result.AccessToken,
      ["admin", "provider"],
      "This is a Customer account. Please sign in from the Customer Login page instead."
    );
    return {
      accessToken: result.AccessToken,
      refreshToken: result.RefreshToken,
      idToken: result.IdToken,
      accessTokenExpiresInSeconds: result.ExpiresIn,
      clientType: "adminProvider",
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw mapCognitoError(err);
  }
}

// ---- Service Provider: self-service signup / verification (FINAL AUTHENTICATION ARCHITECTURE §5) ----

/**
 * Provider self-signup, parallel to `signUpCustomer` above but against the
 * Admin/Provider app client (which HAS a client secret, unlike the Customer
 * client — every call here needs SECRET_HASH). Because this calls `SignUp`
 * with an explicit `Username: email`, a self-registered provider's real
 * Cognito Username ends up being their email itself — exactly like a
 * Customer, and unlike an operator-created (AdminCreateUser/Console)
 * Admin/Provider account. `resolveAdminProviderUsername` (used by login and
 * forgot-password below) handles both cases uniformly either way, so this
 * is not something the rest of the app needs to special-case.
 */
export async function signUpProvider(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<{ userSub: string }> {
  const { clientId, clientSecret } = requireAdminProviderClient();
  const secretHash = computeSecretHash(input.email, clientId, clientSecret);
  try {
    const resp = await getCognitoClient().send(
      new SignUpCommand({
        ClientId: clientId,
        Username: input.email,
        Password: input.password,
        SecretHash: secretHash,
        UserAttributes: [
          { Name: "email", Value: input.email },
          { Name: "name", Value: input.name },
          { Name: "phone_number", Value: input.phone },
        ],
      })
    );
    return { userSub: resp.UserSub ?? "" };
  } catch (err) {
    throw mapCognitoError(err);
  }
}

/** Confirms the SignUp verification code, then assigns the new user to the `provider` Cognito group — mirrors `confirmSignUpCustomer`. */
export async function confirmSignUpProvider(input: { email: string; code: string }): Promise<void> {
  const { clientId, clientSecret } = requireAdminProviderClient();
  const secretHash = computeSecretHash(input.email, clientId, clientSecret);
  try {
    await getCognitoClient().send(
      new ConfirmSignUpCommand({ ClientId: clientId, Username: input.email, ConfirmationCode: input.code, SecretHash: secretHash })
    );
  } catch (err) {
    throw mapCognitoError(err);
  }
  try {
    await getCognitoClient().send(
      new AdminAddUserToGroupCommand({ UserPoolId: requireUserPoolId(), Username: input.email, GroupName: "provider" })
    );
  } catch (err) {
    throw new AppError(
      502,
      "INTERNAL_ERROR",
      "Your email was verified, but your account role could not be assigned. Please contact support.",
      { cause: err instanceof Error ? err.name : String(err) }
    );
  }
}

export async function resendConfirmationCodeProvider(input: { email: string }): Promise<void> {
  const { clientId, clientSecret } = requireAdminProviderClient();
  const secretHash = computeSecretHash(input.email, clientId, clientSecret);
  try {
    await getCognitoClient().send(
      new ResendConfirmationCodeCommand({ ClientId: clientId, Username: input.email, SecretHash: secretHash })
    );
  } catch (err) {
    throw mapCognitoError(err);
  }
}

// ---- Admin + Provider shared forgot-password (FINAL AUTHENTICATION ARCHITECTURE §8) ----

/**
 * Real Cognito ForgotPassword for the shared staff (Admin/Provider) app
 * client. Must resolve the real Cognito Username first — same reasoning as
 * `loginAdminOrProvider` (ISSUE 1): an operator-created account's Username
 * is an opaque value the caller never sees, only the email. If no user is
 * found for this email, this silently reports success anyway (matching
 * `forgotPasswordCustomer`'s existing PreventUserExistenceErrors-parity
 * behavior — never let a caller learn which emails have accounts). Any
 * OTHER kind of failure (e.g. a real AWS/permissions error) still surfaces.
 */
export async function forgotPasswordAdminOrProvider(input: { email: string }): Promise<void> {
  const { clientId, clientSecret } = requireAdminProviderClient();
  let username: string;
  try {
    username = await resolveAdminProviderUsername(input.email);
  } catch (err) {
    if (err instanceof AppError && err.code === "UNAUTHENTICATED") return;
    throw err;
  }
  const secretHash = computeSecretHash(username, clientId, clientSecret);
  try {
    await getCognitoClient().send(new ForgotPasswordCommand({ ClientId: clientId, Username: username, SecretHash: secretHash }));
  } catch (err) {
    throw mapCognitoError(err);
  }
}

export async function confirmForgotPasswordAdminOrProvider(input: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<void> {
  const { clientId, clientSecret } = requireAdminProviderClient();
  const username = await resolveAdminProviderUsername(input.email);
  const secretHash = computeSecretHash(username, clientId, clientSecret);
  try {
    await getCognitoClient().send(
      new ConfirmForgotPasswordCommand({
        ClientId: clientId,
        Username: username,
        ConfirmationCode: input.code,
        Password: input.newPassword,
        SecretHash: secretHash,
      })
    );
  } catch (err) {
    throw mapCognitoError(err);
  }
}

/** Best-effort — revokes all of this user's refresh/access tokens. Never throws; cookies are cleared by the caller regardless of the outcome. */
export async function globalSignOut(accessToken: string): Promise<{ ok: boolean }> {
  try {
    await getCognitoClient().send(new GlobalSignOutCommand({ AccessToken: accessToken }));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
