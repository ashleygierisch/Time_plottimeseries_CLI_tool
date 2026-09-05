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
      'no-restricted-imports': ['error', {
        patterns: [
          {
            // `node:fs` and `fs` resolve to the same module, but only the
            // prefixed form says at a glance that it is not a package
            // somebody could publish under that name.
            regex: '^(assert|buffer|child_process|crypto|events|fs|http|https|net|os|path|process|stream|test|url|util|zlib)(/|$)',
            message: 'Import Node built-ins with the `node:` prefix.',
          },
          {
            // Both bundlers here resolve an extensionless relative import,
            // and `node scripts/whatever.ts` does not. Writing the extension
            // always is the form that works everywhere, so nothing depends on
            // which tool happens to load a file.
            regex: '^\\.\\.?(/.*)?/[^/.]+$',
            message: 'Give relative imports their file extension: `./foo.ts`, not `./foo`.',
          },
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
    // `node:test` groups two ways: `describe`/`it`, and a `test` whose context
    // takes nested `t.test` calls. Both work; having both means two spellings
    // of the same structure, so this repo groups with describe/it and leaves
    // bare `test` for a file of independent checks.
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: "CallExpression[callee.object.name='t'][callee.property.name='test']",
        message: 'Group with describe/it rather than nesting t.test inside a test.',
      }],
    },
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
