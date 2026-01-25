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
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.spec.ts',
      '**/__tests__/**/*.ts',
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

    // Setup files
    setupFiles: ['./tests/setup.ts'],

    // Ignore patterns
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],

    // Enable globals (describe, it, expect, etc.)
    globals: true,

    // Test isolation
    isolate: true,

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
