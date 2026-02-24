/**
 * Vitest Configuration for @yacc/common
 *
 * Configured for:
 * - TypeScript support (.ts files)
 * - ESM module system
 * - Coverage reporting (85%+ target)
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Test file patterns
    include: ['**/__tests__/**/*.spec.ts', '**/__tests__/**/*.test.ts'],

    // Global test timeout
    testTimeout: 10000,

    // Verbose output
    reporters: ['verbose'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/index.ts', 'src/**/index.ts'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },

    // Exclude patterns
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', '**/*.d.ts'],

    // Enable globals (describe, it, expect, etc.)
    globals: true,

    // Test isolation
    isolate: true,
  },

  resolve: {
    alias: {
      '@': './src',
    },
  },
});
