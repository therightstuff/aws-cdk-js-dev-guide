/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: './test/jest-env.cjs',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.{js,mjs}'],
  moduleNameMapper: {
    // ── Lambda layer — pure utility, load real source directly ────────────────
    '^/opt/nodejs/sample-layer/(.+)$': '<rootDir>/layers/src/sample-layer/sample-layer/$1',

    // ── AWS SDK — not installed in root node_modules ───────────────────────────
    '^@aws-sdk/client-dynamodb$': '<rootDir>/test/__mocks__/@aws-sdk/client-dynamodb.mjs',
    '^@aws-sdk/lib-dynamodb$':    '<rootDir>/test/__mocks__/@aws-sdk/lib-dynamodb.mjs',
    '^@aws-sdk/client-sqs$':      '<rootDir>/test/__mocks__/@aws-sdk/client-sqs.mjs',

    // ── Layer packages not installed in root node_modules ─────────────────────
    '^uuid$': '<rootDir>/test/__mocks__/uuid.mjs',
  },

  // ── Coverage ──────────────────────────────────────────────────────────────
  coverageProvider: 'v8',
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    // All JS Lambda handlers except Python
    'handlers/**/*.mjs',
    // Layer source (sample-layer only has utils.mjs)
    'layers/src/sample-layer/sample-layer/*.mjs',
    // postgres handler requires a live DB connection — excluded from unit coverage
    '!handlers/postgres/index.mjs',
  ],
};
