import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import unicorn from 'eslint-plugin-unicorn';
import prettier from 'eslint-config-prettier';

export default [
  /* ===============================
   * Base JS rules
   * =============================== */
  js.configs.recommended,

  /* ===============================
   * TypeScript rules
   * =============================== */
  ...tseslint.configs.recommended,

  /* ===============================
   * Project rules
   * =============================== */
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      import: importPlugin,
      unicorn,
    },
    rules: {
      /* ---------- Correctness ---------- */
      'no-debugger': 'error',
      'no-console': 'warn',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],

      /* ---------- Imports ---------- */
      'import/no-duplicates': 'error',
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

       /* ---------- TypeScript ---------- */
       '@typescript-eslint/no-unused-vars': [
         'error',
         { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
       ],
       '@typescript-eslint/consistent-type-imports': 'error',
       '@typescript-eslint/no-unused-expressions': 'off',

      /* ---------- Structure ---------- */
      'max-classes-per-file': ['error', 1],

      /* ---------- Export policy (IMPORTANT) ---------- */
      'no-restricted-syntax': [
        'error',

        // ❌ Disallow: export * from './x'
        {
          selector: 'ExportAllDeclaration',
          message:
            'Do not use `export * from`. Only `export default` and `export const ...` are allowed.',
        },

        // ❌ Disallow: export { foo } / export { foo } from './x'
        {
          selector: 'ExportNamedDeclaration[specifiers.length>0]',
          message:
            'Do not use `export { ... }`. Use `export const foo = ...` or `export default ...`.',
        },

        // ❌ Disallow: export { foo } from './x'
        {
          selector: 'ExportNamedDeclaration[source!=null]',
          message:
            'Re-exports are not allowed. Import locally, then export `const` or `default`.',
        },
      ],

       /* ---------- Unicorn (safe defaults) ---------- */
       // Note: Some unicorn rules require ESLint 9 and may fail with ESLint 8
       // Disable problematic rules for now
       'unicorn/prefer-node-protocol': 'off',
       'unicorn/prefer-string-replace-all': 'off',
       'unicorn/no-abusive-eslint-disable': 'off',
        'unicorn/filename-case': [
          'error',
          {
            cases: {
              camelCase: true,
            },
            ignore: [
              // Config files (standard naming exceptions)
              'vite.config.ts',
              'vitest.config.ts',
              'playwright.config.ts',
              'drizzle.config.ts',
              'eslint.config.js',
              'turbo.json',
              '.eslintignore',
              'tsconfig.json',
              'jest.config.ts',
              // React root component
              'App.tsx',
            ],
          },
        ],
    },
  },

  /* ===============================
   * Component and Context files (PascalCase allowed)
   * =============================== */
  {
    files: [
      '**/components/**/*.{tsx,ts}',
      '**/pages/**/*.{tsx,ts}',
      '**/contexts/**/*.{tsx,ts}',
    ],
    rules: {
      'unicorn/filename-case': 'off',
    },
  },

  /* ===============================
   * Prettier compatibility
   * =============================== */
   prettier,
];
