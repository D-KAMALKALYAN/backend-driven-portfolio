import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['dist', 'node_modules', 'supabase/.temp', 'coverage'] },

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // The codebase carries eslint-disable comments for a linter that was
      // never installed. Now that it is, exhaustive-deps is the rule that
      // matters most: useSupabaseQuery spreads a caller-supplied deps array
      // into useCallback, so a wrong deps list is a stale closure or an
      // infinite loop with no other warning.
      'react-hooks/exhaustive-deps': 'warn',

      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],

      // Fire-and-forget telemetry and debug logging are intentional here.
      'no-console': ['warn', { allow: ['warn', 'error', 'debug', 'info'] }],

      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },

  {
    files: ['**/__tests__/**/*.{js,jsx}', '**/*.test.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-console': 'off',
    },
  },

  {
    files: ['*.config.js', 'vite.config.js', 'vitest.config.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
