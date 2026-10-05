import { CognitoJwtVerifier } from "aws-jwt-verify";
import { env } from "../../config/env";

/**
 * The single Cognito JWT verifier the whole backend uses
 * (PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md §17 / PHASE_2_AUTHORIZATION_MATRIX.md §4):
 * one User Pool, both app clients accepted (role is determined from the
 * token's `cognito:groups` claim after verification, not from which app
 * client issued it — see the Authorization Matrix doc).
 *
 * Verification performed by this instance (delegated to aws-jwt-verify,
 * not reimplemented): signature against the pool's JWKS, `iss` against the
 * pool, `aud`/`client_id` against one of the two configured app clients,
 * `token_use` = "access", and expiry — exactly PHASE_2_BACKEND_SYSTEM_ARCHITECTURE.md §17.
 *
 * Built lazily so a missing COGNITO_USER_POOL_ID (e.g. in an environment
 * that hasn't been given real Cognito details yet) doesn't crash the whole
 * process at import time — it only fails when an authenticated route is
 * actually hit, with a clear error.
 *
 * Tests never call real Cognito: they build a verifier for a test pool ID
 * and use `.cacheJwks()` (a real aws-jwt-verify feature meant for exactly
 * this) to inject a locally-generated test JWKS, then mint tokens signed
 * with the matching private key. See tests/helpers/cognitoTestKit.ts.
 */
export type AppCognitoVerifier = ReturnType<typeof buildVerifier>;

export function buildVerifier(overrides?: { userPoolId?: string; clientIds?: string[] }) {
  const userPoolId = overrides?.userPoolId ?? env.COGNITO_USER_POOL_ID;
  const clientIds =
    overrides?.clientIds ??
    [env.COGNITO_CUSTOMER_APP_CLIENT_ID, env.COGNITO_ADMIN_PROVIDER_APP_CLIENT_ID].filter(
      (id): id is string => Boolean(id)
    );

  if (!userPoolId) {
    throw new Error(
      "COGNITO_USER_POOL_ID is not configured — cannot verify access tokens. Set it in the environment before handling authenticated requests."
    );
  }

  return CognitoJwtVerifier.create({
    userPoolId,
    tokenUse: "access",
    clientId: clientIds.length > 0 ? clientIds : null,
  });
}

let singleton: AppCognitoVerifier | null = null;

/** Production/runtime accessor — built once, from environment config. */
export function getVerifier(): AppCognitoVerifier {
  if (!singleton) {
    singleton = buildVerifier();
  }
  return singleton;
}

/** Test-only hook: lets tests substitute a verifier pointed at a test pool/JWKS. */
export function setVerifierForTests(verifier: AppCognitoVerifier | null): void {
  singleton = verifier;
}
