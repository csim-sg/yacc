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

export default {
  // Preset for TypeScript support
  preset: 'ts-jest',

  // Test environment
  testEnvironment: 'node',

  // Root directories
  roots: ['<rootDir>/src', '<rootDir>/tests'],

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/__tests__/**/*.ts',
    '**/tests/**/*.spec.ts',
  ],

  // Module resolution
  moduleNameMapper: {
    '^@yacc/common/(.*)$': '<rootDir>/../common/src/$1',
    '^@yacc/backend/(.*)$': '<rootDir>/src/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Transform
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ES2020',
        target: 'ES2020',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        baseUrl: '.',
        paths: {
          '@yacc/common/*': ['../common/src/*'],
          '@yacc/backend/*': ['src/*'],
          '@/*': ['src/*'],
        },
      },
    }],
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
