/**
 * eslint.config.js — lint rules for the front end (ESLint "flat config").
 * Owner: team.
 *
 * - @eslint/js + typescript-eslint: catch real bugs (unused variables, wrong types, etc.).
 * - react-hooks: enforce the Rules of Hooks (e.g. effects list their dependencies).
 * - react-refresh: keeps hot-reload working in `npm run dev`.
 * - eslint-config-prettier goes LAST: it turns off style rules, because Prettier owns formatting.
 */
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'playwright-report', 'test-results', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },
  {
    // Config files and e2e tests run in Node.
    files: ['*.config.{ts,js}', 'e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  prettier,
]);
