import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintReact from '@eslint-react/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', 'pages-public/', 'node_modules/'] },
  eslint.configs.recommended,
  // Type-aware rules, not just the syntactic ones. They are the reason the
  // linter can see a floating promise, a Buffer used as a string, or an
  // assertion that no longer asserts anything -- none of which are visible
  // from the syntax alone. `projectService` picks src/tsconfig.json or
  // scripts/tsconfig.json per file, so the two projects keep their own
  // settings.
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // `node:test`'s test/describe/it return a promise the runner owns; the
      // caller is not meant to await it. Everything else still has to be
      // handled, which is the point of the rule.
      '@typescript-eslint/no-floating-promises': ['error', {
        allowForKnownSafeCalls: [
          { from: 'package', package: 'node:test', name: ['describe', 'it', 'test'] },
        ],
      }],
    },
  },
  {
    // This config file is plain JS outside either tsconfig project, so there
    // are no types to check it against.
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // React lives entirely under src/; scripts/ is plain Node.
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      eslintReact.configs['recommended-typescript'],
      reactHooks.configs.flat['recommended-latest'],
    ],
  }
);
