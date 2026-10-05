import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { env } from "../../config/env";

/**
 * The single Cognito Identity Provider SDK client the backend uses to
 * ACT on the user pool (SignUp, InitiateAuth, ForgotPassword, GlobalSignOut,
 * AdminAddUserToGroup, ...) — distinct from `verifier.ts`, which only
 * verifies already-issued tokens and never calls the Cognito API itself.
 *
 * Built lazily, same reasoning as `verifier.ts`/`media.service.ts`'s S3
 * client: a sandbox/dev environment with no real AWS credentials configured
 * shouldn't crash at import time, only when an auth action is actually
 * requested. In production (ECS Fargate) `AWS_ACCESS_KEY_ID`/`_SECRET_` are
 * never set — the SDK's default provider chain resolves credentials from the
 * task's IAM role instead, exactly as the existing S3 client already does.
 *
 * The AUTHENTICATION & AUTHORIZATION PHASE brief's explicit credential split:
 * this project's local/sandbox Node backend has no real AWS credentials at
 * all, so every call through this client is exercised in automated tests
 * against a fake client installed via `setCognitoClientForTests()` (see
 * tests/helpers/cognitoClientTestKit.ts) — never a real network call. Real
 * Cognito behavior for the new pool Groups/app client/test users was
 * verified separately, directly, via the AWS MCP connector.
 */
export type AppCognitoClient = Pick<CognitoIdentityProviderClient, "send">;

let singleton: AppCognitoClient | null = null;

export function getCognitoClient(): AppCognitoClient {
  if (!singleton) {
    singleton = new CognitoIdentityProviderClient({
      region: env.COGNITO_REGION,
      ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? { credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY } }
        : {}),
    });
  }
  return singleton;
}

/** Test-only hook: lets tests substitute a fake `{ send }` client — never a real network call. */
export function setCognitoClientForTests(client: AppCognitoClient | null): void {
  singleton = client;
}
