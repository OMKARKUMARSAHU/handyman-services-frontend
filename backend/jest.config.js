/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/helpers/jest.setup.ts"],
  clearMocks: true,
  testTimeout: 20000,
  forceExit: true,
};
