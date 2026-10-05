import { generateKeyPairSync, randomUUID, sign as cryptoSign, type KeyObject } from "node:crypto";
import { buildVerifier, setVerifierForTests, type AppCognitoVerifier } from "../../src/modules/auth/verifier";
import type { Role } from "../../src/modules/auth/roles";

/**
 * Genuine, non-mocked Cognito JWT verification testing without any real
 * AWS/Cognito credentials or network access (PHASE_3 brief — tests must
 * exercise real signature/issuer/audience/expiry checks, not bypass them).
 *
 * Strategy: generate a local RSA keypair, expose its public half as a JWKS,
 * and hand that JWKS to the SAME `aws-jwt-verify` verifier class the app
 * uses in production via its documented `.cacheJwks()` test-hydration API
 * (confirmed present on `CognitoJwtVerifier` by inspecting
 * node_modules/aws-jwt-verify/jwt-rsa.d.ts before relying on it). Tokens are
 * then hand-signed (RS256, no external JWT library) with the matching
 * private key. A token with a bad signature, wrong issuer, wrong audience,
 * unrecognized group, or expired `exp` is rejected by the REAL verification
 * code path — nothing about `authenticate()` is mocked or bypassed.
 */

export const TEST_USER_POOL_ID = "ap-south-1_TESTPOOL01";
export const TEST_REGION = "ap-south-1";
export const TEST_ISSUER = `https://cognito-idp.${TEST_REGION}.amazonaws.com/${TEST_USER_POOL_ID}`;
export const TEST_CUSTOMER_CLIENT_ID = "test-customer-app-client";
export const TEST_ADMIN_PROVIDER_CLIENT_ID = "test-admin-provider-app-client";
const KID = "test-signing-key-1";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

function base64url(input: string | Buffer): string {
  return Buffer.from(input as never).toString("base64url");
}

function signRs256(headerAndPayload: string, key: KeyObject): string {
  const signature = cryptoSign("sha256", Buffer.from(headerAndPayload), key);
  return signature.toString("base64url");
}

export interface MintTokenOptions {
  sub?: string;
  role?: Role;
  /** Overrides the `cognito:groups` claim entirely (e.g. `[]` to test "no recognized role"). */
  groups?: string[];
  clientId?: string;
  issuer?: string;
  tokenUse?: "access" | "id";
  expiresInSeconds?: number;
  issuedAtOffsetSeconds?: number;
  extraClaims?: Record<string, unknown>;
  /** Set to sign with a key that does NOT match the cached JWKS, to test signature rejection. */
  useWrongKey?: boolean;
}

const wrongKeyPair = generateKeyPairSync("rsa", { modulusLength: 2048 });

/** Mints a syntactically real, RS256-signed JWT with the given (or sensible default) claims. */
export function mintToken(options: MintTokenOptions = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const role = options.role ?? "customer";
  const clientId =
    options.clientId ?? (role === "customer" ? TEST_CUSTOMER_CLIENT_ID : TEST_ADMIN_PROVIDER_CLIENT_ID);

  const header = { alg: "RS256", typ: "JWT", kid: KID };
  const payload = {
    sub: options.sub ?? randomUUID(),
    "cognito:groups": options.groups ?? [role],
    token_use: options.tokenUse ?? "access",
    client_id: clientId,
    iss: options.issuer ?? TEST_ISSUER,
    iat: now + (options.issuedAtOffsetSeconds ?? 0),
    exp: now + (options.expiresInSeconds ?? 3600),
    name: "Test User",
    email: "test-user@example.com",
    phone_number: "+911234567890",
    ...options.extraClaims,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const key = options.useWrongKey ? wrongKeyPair.privateKey : privateKey;
  return `${signingInput}.${signRs256(signingInput, key)}`;
}

export function bearer(token: string): string {
  return `Bearer ${token}`;
}

let testVerifier: AppCognitoVerifier | null = null;

/**
 * Builds a real `CognitoJwtVerifier` pointed at the fake test pool/clients,
 * hydrates it with this kit's public JWKS via `.cacheJwks()` (never a
 * network fetch), and installs it as the app's singleton verifier for the
 * duration of the test run.
 */
export function installTestVerifier(): void {
  testVerifier = buildVerifier({
    userPoolId: TEST_USER_POOL_ID,
    clientIds: [TEST_CUSTOMER_CLIENT_ID, TEST_ADMIN_PROVIDER_CLIENT_ID],
  });
  const jwk = publicKey.export({ format: "jwk" }) as { kty: string; n: string; e: string };
  testVerifier.cacheJwks({ keys: [{ kty: jwk.kty, n: jwk.n, e: jwk.e, kid: KID, use: "sig", alg: "RS256" }] });
  setVerifierForTests(testVerifier);
}

export function uninstallTestVerifier(): void {
  setVerifierForTests(null);
  testVerifier = null;
}
