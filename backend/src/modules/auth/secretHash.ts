import { createHmac } from "node:crypto";

/**
 * Cognito's required SECRET_HASH for any app client created WITH a client
 * secret (the Admin/Provider app client — a confidential, backend-only
 * client; the Customer app client has no secret and never needs this).
 * `SECRET_HASH = Base64(HMAC_SHA256(key = clientSecret, message = username + clientId))`
 * — exactly AWS's documented algorithm, nothing invented.
 */
export function computeSecretHash(username: string, clientId: string, clientSecret: string): string {
  return createHmac("sha256", clientSecret).update(username + clientId).digest("base64");
}
