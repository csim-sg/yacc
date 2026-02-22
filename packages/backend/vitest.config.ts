/**
 * Vitest Configuration for @yacc/backend
 * 
 * Configured for:
 * - TypeScript support (.ts files)
 * - ESM module system
 * - Drizzle ORM database operations
 * - Path aliases (@yacc/common, @/*)
 * - Coverage reporting (85%+ target)
 * - Fast test execution with Vitest's parallelization
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Test file patterns
    // By default, skip integration tests (WebSocket, queue tests)
    // To run integration tests: RUN_INTEGRATION_TESTS=true pnpm test
    include: process.env.RUN_INTEGRATION_TESTS === 'true'
      ? [
          'tests/**/*.test.ts',
          'tests/**/*.spec.ts',
          '**/__tests__/**/*.ts',
        ]
      : [
          'tests/**/*.test.ts',
          'tests/**/*.spec.ts',
          '**/__tests__/**/*.ts',
          // Explicitly exclude integration tests when not requested
          '!tests/integration/**',
          '!src/services/__tests__/**/*integration*',
        ],

    // Global test timeout
    testTimeout: 10000,

    // Verbose output
    reporters: ['verbose'],

    // Coverage configuration
    coverage: {
       provider: 'v8',
       reporter: ['text', 'json', 'html', 'lcov'],
       include: ['src/**/*.ts'],
       exclude: [
         'src/**/*.d.ts',
        'src/index.ts',
         'src/**/index.ts',
         'src/infrastructure/**',
         'src/config/**',
       ],
       thresholds: {
         lines: 85,
         functions: 85,
         branches: 80,
         statements: 85,
       },
    },

    // Global setup (runs once before all tests)
    globalSetup: ['./tests/globalSetup.ts'],

    // Setup files (runs before each test file)
    setupFiles: ['./tests/setup.ts'],

    // Ignore patterns - exclude build artifacts and TypeScript declaration files
    exclude: ['node_modules', 'dist', 'dist-tmp', '.idea', '.git', '.cache', '**/*.d.ts'],

    // Enable globals (describe, it, expect, etc.)
    globals: true,

    // Test isolation
    isolate: true,

    // Disable file parallelism to prevent DB race conditions
    // Tests share the same database and can interfere with each other
    fileParallelism: false,

    // Mock reset between tests
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
  },

  resolve: {
    alias: {
      '@yacc/common': '../../common/src',
      '@yacc/backend': './src',
      '@': './src',
    },
  },
});
