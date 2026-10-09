/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/helpers/jest.setup.ts"],
  clearMocks: true,
  testTimeout: 20000,
  // sanitize-html -> htmlparser2 v12 (and its dom* deps) ship ESM-only; ts-jest
  // must transpile them to CommonJS so the Blog service can be imported in tests.
  transform: {
    "^.+\\.[tj]sx?$": [
      "ts-jest",
      {
        tsconfig: { allowJs: true, esModuleInterop: true, module: "commonjs", target: "ES2022", skipLibCheck: true, types: ["node", "jest"] },
        diagnostics: false,
      },
    ],
  },
  transformIgnorePatterns: ["/node_modules/(?!(htmlparser2|domutils|domhandler|dom-serializer|domelementtype|entities)/)"],
  forceExit: true,
};
