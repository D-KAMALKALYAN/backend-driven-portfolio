import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';

export default tseslint.config(
  { ignores: ['dist', '.next', 'node_modules', 'supabase/.temp', 'coverage', 'src/types/database.ts', 'next-env.d.ts'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
    },
    plugins: {
      'react-hooks': reactHooks,
      '@next/next': nextPlugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      // Cover images come from Supabase storage at whatever size was
      // uploaded; next/image would add an optimiser hop for a handful of
      // images. Revisit if the project count grows.
      '@next/next/no-img-element': 'off',

      // exhaustive-deps is the rule that matters most in this codebase: a
      // wrong deps list is a stale closure or an infinite loop with no other
      // warning.
      'react-hooks/exhaustive-deps': 'warn',

      // The TypeScript-aware version replaces core no-unused-vars, which
      // false-positives on type-only usage.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],

      // `any` is what the migration exists to remove. An explicit one must be
      // justified at the site, not waved through.
      '@typescript-eslint/no-explicit-any': 'error',

      // Fire-and-forget telemetry and debug logging are intentional here.
      'no-console': ['warn', { allow: ['warn', 'error', 'debug', 'info'] }],

      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },

  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-console': 'off',
    },
  },

  {
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
);
