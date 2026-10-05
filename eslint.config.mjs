import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Dev-only data-generation / verification scripts — not part of the
    // shipped Next.js app (see scripts/README-ish comments in each file).
    "scripts/**",
    // The backend is its own independent TypeScript/Node project with its
    // own eslint config and `npm run lint` (backend/package.json) — same
    // reasoning as tsconfig.json's "backend" exclude. Without this, the
    // root (Next.js) eslint run also tries to lint backend source AND its
    // compiled `dist/` output as if they were part of this app.
    "backend/**",
  ]),
]);

export default eslintConfig;
