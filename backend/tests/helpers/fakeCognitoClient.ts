import { mintToken, TEST_CUSTOMER_CLIENT_ID, TEST_ADMIN_PROVIDER_CLIENT_ID } from "./cognitoTestKit";
import { setCognitoClientForTests, type AppCognitoClient } from "../../src/modules/auth/cognito.client";

/**
 * A genuine in-memory simulation of the slice of the real Cognito API this
 * backend calls (SignUp/ConfirmSignUp/InitiateAuth+RespondToAuthChallenge/
 * ForgotPassword/ConfirmForgotPassword/GlobalSignOut/AdminAddUserToGroup) —
 * not a trivial `jest.fn().mockResolvedValue(...)` stub. It enforces the
 * same state machine the real pool does (an unconfirmed user can't log in,
 * a wrong confirmation code is rejected, a wrong password is rejected,
 * AdminAddUserToGroup is what actually puts a `cognito:groups` entry on the
 * user that later shows up in their token) and, on a successful login,
 * mints a REAL RS256-signed JWT via the exact same keypair/JWKS
 * `cognitoTestKit.ts` installs as the app's verifier — so a token this fake
 * returns is then genuinely verified by the real `authenticate()`
 * middleware in the assertions below, exactly like it would be in
 * production. Only the Cognito API call itself is faked; everything
 * downstream of "here is a token" is the real code path.
 *
 * This is necessary (not optional) per the AUTHENTICATION & AUTHORIZATION
 * PHASE brief's credential split: this sandbox's Node backend has no real
 * AWS credentials, so these flows cannot be exercised against the real
 * Cognito API here — they were verified separately, directly, via the AWS
 * MCP connector (see the final report for exactly which calls that covered).
 */

interface FakeUser {
  email: string;
  name: string;
  password: string;
  status: "UNCONFIRMED" | "CONFIRMED";
  confirmationCode: string;
  forgotPasswordCode?: string;
  groups: string[];
}

const SIGNUP_CODE = "111111";
const FORGOT_CODE = "222222";

export class FakeCognitoStore {
  users = new Map<string, FakeUser>();
  revokedTokens = new Set<string>();

  /** Pre-seed a CONFIRMED user already in a group — simulating the real, already-provisioned test Provider/Admin accounts. */
  seedConfirmedUser(email: string, password: string, name: string, groups: string[]): void {
    this.users.set(email, { email, name, password, status: "CONFIRMED", confirmationCode: SIGNUP_CODE, groups });
  }
}

function cognitoError(name: string, message: string): Error {
  return Object.assign(new Error(message), { name });
}

export function installFakeCognitoClient(store: FakeCognitoStore = new FakeCognitoStore()): FakeCognitoStore {
  const client: AppCognitoClient = {
    async send(command: unknown) {
      const name = (command as { constructor: { name: string } }).constructor.name;
      const input = (command as { input: Record<string, unknown> }).input;

      switch (name) {
        case "SignUpCommand": {
          const email = String(input.Username);
          if (store.users.has(email)) throw cognitoError("UsernameExistsException", "An account with this email already exists.");
          const attrs = input.UserAttributes as Array<{ Name: string; Value: string }>;
          const nameAttr = attrs.find((a) => a.Name === "name")?.Value ?? "Customer";
          store.users.set(email, {
            email,
            name: nameAttr,
            password: String(input.Password),
            status: "UNCONFIRMED",
            confirmationCode: SIGNUP_CODE,
            groups: [],
          });
          return { UserSub: `fake-sub-${email}` };
        }

        case "ConfirmSignUpCommand": {
          const email = String(input.Username);
          const user = store.users.get(email);
          if (!user) throw cognitoError("UserNotFoundException", "User not found.");
          if (String(input.ConfirmationCode) !== user.confirmationCode) {
            throw cognitoError("CodeMismatchException", "Invalid verification code.");
          }
          user.status = "CONFIRMED";
          return {};
        }

        case "ResendConfirmationCodeCommand": {
          const email = String(input.Username);
          if (!store.users.has(email)) throw cognitoError("UserNotFoundException", "User not found.");
          return { CodeDeliveryDetails: { Destination: email, DeliveryMedium: "EMAIL" } };
        }

        case "InitiateAuthCommand": {
          const params = input.AuthParameters as Record<string, string>;
          const email = String(params.USERNAME);
          // A real pool challenges before confirming the user exists (PreventUserExistenceErrors) —
          // the fake mirrors that by always returning a challenge/session here, deferring the
          // existence/password/confirmation checks to RespondToAuthChallenge, exactly like real Cognito.
          return { ChallengeName: "PASSWORD", Session: `fake-session:${email}`, ChallengeParameters: {} };
        }

        case "RespondToAuthChallengeCommand": {
          const session = String(input.Session);
          const responses = input.ChallengeResponses as Record<string, string>;
          const email = String(responses.USERNAME);
          if (session !== `fake-session:${email}`) throw cognitoError("NotAuthorizedException", "Invalid session.");

          const user = store.users.get(email);
          if (!user || user.password !== responses.PASSWORD) {
            throw cognitoError("NotAuthorizedException", "Incorrect username or password.");
          }
          if (user.status !== "CONFIRMED") {
            throw cognitoError("UserNotConfirmedException", "User is not confirmed.");
          }

          const isAdminProvider = user.groups.includes("admin") || user.groups.includes("provider");
          const clientId = isAdminProvider ? TEST_ADMIN_PROVIDER_CLIENT_ID : TEST_CUSTOMER_CLIENT_ID;
          const token = mintToken({
            sub: `fake-sub-${email}`,
            groups: user.groups,
            clientId,
            extraClaims: { email, name: user.name },
          });
          return {
            AuthenticationResult: {
              AccessToken: token,
              IdToken: token,
              RefreshToken: `fake-refresh-${email}`,
              ExpiresIn: 3600,
              TokenType: "Bearer",
            },
          };
        }

        case "ForgotPasswordCommand": {
          const email = String(input.Username);
          const user = store.users.get(email);
          // PreventUserExistenceErrors: succeed generically even for a non-existent user.
          if (user) user.forgotPasswordCode = FORGOT_CODE;
          return { CodeDeliveryDetails: { Destination: email, DeliveryMedium: "EMAIL" } };
        }

        case "ConfirmForgotPasswordCommand": {
          const email = String(input.Username);
          const user = store.users.get(email);
          if (!user || !user.forgotPasswordCode) throw cognitoError("ExpiredCodeException", "No password reset in progress.");
          if (String(input.ConfirmationCode) !== user.forgotPasswordCode) {
            throw cognitoError("CodeMismatchException", "Invalid verification code.");
          }
          user.password = String(input.Password);
          user.forgotPasswordCode = undefined;
          return {};
        }

        case "GlobalSignOutCommand": {
          store.revokedTokens.add(String(input.AccessToken));
          return {};
        }

        case "AdminAddUserToGroupCommand": {
          const email = String(input.Username);
          const user = store.users.get(email);
          if (!user) throw cognitoError("UserNotFoundException", "User not found.");
          const group = String(input.GroupName);
          if (!user.groups.includes(group)) user.groups.push(group);
          return {};
        }

        default:
          throw new Error(`FakeCognitoClient: unhandled command ${name}`);
      }
    },
  };

  setCognitoClientForTests(client);
  return store;
}

export function uninstallFakeCognitoClient(): void {
  setCognitoClientForTests(null);
}
