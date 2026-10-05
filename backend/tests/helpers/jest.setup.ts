import "dotenv/config";
import { closeDb } from "../../src/database/db";
import { installTestVerifier, uninstallTestVerifier } from "./cognitoTestKit";

if (process.env.NODE_ENV !== "test") {
  // Safety net: tests must never run against the development/production
  // database profile (PHASE_3 brief's "never touch RDS" rule extends to
  // "never even point the test suite at the dev database by accident").
  throw new Error(`Refusing to run tests with NODE_ENV="${process.env.NODE_ENV}" — expected "test".`);
}

beforeAll(() => {
  installTestVerifier();
});

afterAll(async () => {
  uninstallTestVerifier();
  await closeDb();
});
