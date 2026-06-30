/**
 * Jest configuration for the RespondLeadz canonical pipeline.
 *
 * Tests run under ts-jest with a CommonJS transform so the pure pipeline
 * modules (signature, parser, conversation engine, AI responder, etc.) can be
 * exercised directly in Node. Property-based tests use fast-check.
 *
 * The `@/` path alias is mapped to the project root to match tsconfig.json so
 * test imports resolve the same way the Next.js build does.
 *
 * Tenant-isolation property tests that require a live Postgres with RLS are
 * gated behind the RESPONDLEADZ_TEST_DATABASE env var and are skipped when it
 * is not set (see the individual test files), so the default `npm test` run is
 * hermetic and needs no database.
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/lib', '<rootDir>/app', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        diagnostics: false,
      },
    ],
  },
  clearMocks: true,
  // Property-based tests generate >= 100 cases each; give them headroom.
  testTimeout: 30000,
}
