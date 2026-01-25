/**
 * Jest Configuration for @yacc/backend
 * 
 * Configured for:
 * - TypeScript support (.ts files)
 * - ESM module system
 * - Drizzle ORM database operations
 * - Path aliases (@yacc/common, @/*)
 * - Coverage reporting (85%+ target)
 */

import type { Config } from 'jest';

const config: Config = {
  // Preset for TypeScript support
  preset: 'ts-jest',

  // Test environment
  testEnvironment: 'node',

  // Enable ESM module support
  extensionsToTreatAsEsm: ['.ts'],

  // Root directories
  roots: ['<rootDir>/src', '<rootDir>/tests'],

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/__tests__/**/*.ts',
    '**/tests/**/*.spec.ts',
  ],

  // Extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Transform
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      extensionsToTreatAsEsm: ['.ts'],
      tsconfig: {
        module: 'ES2020',
        target: 'ES2020',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        skipLibCheck: true,
        baseUrl: '.',
        paths: {
          '@yacc/common/*': ['../common/src/*'],
          '@yacc/backend/*': ['src/*'],
          '@/*': ['src/*'],
        },
      },
    }],
  },

  // Module resolution - handles both .js extension imports and path aliases
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1', // Strip .js extensions from imports
    '^@yacc/common/(.*)$': '<rootDir>/../common/src/$1',
    '^@yacc/backend/(.*)$': '<rootDir>/src/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/**/index.ts',
    '!src/infrastructure/**',
    '!src/config/**',
  ],

  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },

  // Timeout for long-running tests (e.g., database operations)
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],

  // Global setup/teardown
  globalSetup: '<rootDir>/tests/global-setup.ts',
  globalTeardown: '<rootDir>/tests/global-teardown.ts',
};

export default config;
