import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import importNewlines from "eslint-plugin-import-newlines";
import jest from "eslint-plugin-jest";
import nodePlugin from "eslint-plugin-n";
import promise from "eslint-plugin-promise";
import security from "eslint-plugin-security";
import sql from "eslint-plugin-sql";
import unicorn from "eslint-plugin-unicorn";
import unusedImports from "eslint-plugin-unused-imports";
import {
  basicFormattingRules,
  strictFormattingRules,
} from "./eslint-rules/formatting.js";
import { nodeGlobals, jestGlobals } from "./eslint-rules/globals.js";
import { multilineFormattingRules } from "./eslint-rules/multiline.js";
import {
  typescriptRules,
  relaxedTypescriptRules,
  configFileTypescriptRules,
  typeDefinitionRules,
} from "./eslint-rules/typescript.js";
import { unusedVariablesRules } from "./eslint-rules/unused-variables.js";

export default [
  // === Global ignores ===
  {
    ignores: ["node_modules/**", "coverage/**", "dist/**"],
  },

  // Base JavaScript recommended rules
  js.configs.recommended,

  // === XO-style base rules (DRY: using extracted rule sets) ===
  {
    rules: {
      // Use extracted formatting rules
      ...basicFormattingRules,
      ...multilineFormattingRules,

      // Additional base rules
      "array-bracket-spacing": ["error", "never"],
      "keyword-spacing": "error",
      "space-infix-ops": "error",
      "eol-last": "error",
      "no-trailing-spaces": "error",
      "no-multiple-empty-lines": ["error", { max: 1 }],

      // Override array-element-newline for base config
      "array-element-newline": [
        "error",
        {
          ArrayExpression: "consistent",
          ArrayPattern: { minItems: 3 },
        },
      ],
    },
  },

  // === Security plugin configuration ===
  security.configs.recommended,

  // === Import plugin configuration ===
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      ...importPlugin.configs.recommended.rules,
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "never",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      "import/no-unresolved": "off", // TypeScript handles this
      "import/extensions": "off", // We prefer no extensions
      "import/newline-after-import": "error",
    },
  },

  // === Promise plugin configuration ===
  {
    plugins: {
      promise,
    },
    rules: {
      ...promise.configs.recommended.rules,
    },
  },

  // === Unicorn plugin configuration ===
  {
    plugins: {
      unicorn,
    },
    rules: {
      ...unicorn.configs.recommended.rules,
      "unicorn/prevent-abbreviations": "off", // Allow common abbreviations
      "unicorn/filename-case": ["error", { case: "kebabCase" }],
      "unicorn/no-null": "off", // Allow null when needed
      "unicorn/prefer-module": "off", // Allow CommonJS when needed
    },
  },

  // === SQL plugin configuration ===
  {
    plugins: {
      sql,
    },
    rules: {
      "sql/format": [
        "error",
        {
          ignoreExpressions: false,
          ignoreInline: true,
          ignoreTagless: true,
        },
      ],
      "sql/no-unsafe-query": [
        "error",
        {
          allowLiteral: false,
        },
      ],
    },
    settings: {
      sql: {
        placeholderRule: String.raw`\$[0-9]+|\?`,
      },
    },
  },

  // === Import newlines plugin configuration ===
  {
    plugins: {
      "import-newlines": importNewlines,
    },
    rules: {
      "import-newlines/enforce": [
        "error",
        {
          items: 3,
          "max-len": 120,
          semi: false,
        },
      ],
    },
  },

  // === Configuration files overrides ===
  {
    files: [
      "./esbuild.config.ts",
      "./jest.config.ts",
      "./run-lint-staged.ts",
      "./run-all-tests.ts",
      "./test-extensions.ts",
    ],
    rules: {
      "n/no-unpublished-import": "off",
      "n/no-process-exit": "off",
      "unicorn/no-process-exit": "off",
      "unicorn/prefer-top-level-await": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
    },
  },

  // === Test files overrides ===
  {
    files: ["tests/**/*.ts", "test-*.ts", "**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "n/no-unpublished-import": "off",
      "jest/no-conditional-expect": "off",
      "max-lines-per-function": "off",
      "unicorn/import-style": "off",
    },
  },

  // TypeScript recommended rules
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: ["./tsconfig.json"],
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      n: nodePlugin,
      "unused-imports": unusedImports,
    },
    rules: {
      // Include TypeScript recommended rules
      ...tseslint.configs.recommended.rules,
      ...tseslint.configs["recommended-requiring-type-checking"].rules,
      // Node.js rules
      ...nodePlugin.configs.recommended.rules,
      "n/no-missing-import": "off", // TypeScript handles this
      "n/no-unsupported-features/es-syntax": "off", // We use modern ES features
      // === DRY: Use extracted rule sets ===
      ...strictFormattingRules,
      ...unusedVariablesRules,
      ...multilineFormattingRules,
      ...typescriptRules,

      // TypeScript-specific override for import consistency
      "object-curly-newline": [
        "error",
        {
          ObjectExpression: {
            multiline: true,
            minProperties: 4,
            consistent: true,
          },
          ObjectPattern: {
            multiline: true,
            minProperties: 4,
            consistent: true,
          },
          ImportDeclaration: {
            multiline: true,
            minProperties: 3,
            consistent: false,
          },
          ExportDeclaration: {
            multiline: true,
            minProperties: 4,
            consistent: true,
          },
        },
      ],
    },
  },

  {
    files: ["**/*.ts", "**/*.js"],
    languageOptions: {
      globals: {
        // DRY: Use extracted globals
        ...nodeGlobals,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "unused-imports": unusedImports,
    },
    rules: {
      // === DRY: Use extracted rule sets ===
      ...basicFormattingRules,
      ...unusedVariablesRules,
      ...multilineFormattingRules,
      ...typescriptRules,
    },
  },
  {
    files: [
      "tests/**/*.ts",
      "tests/**/*.js",
      "**/*.test.ts",
      "**/*.test.js",
      "**/*.spec.ts",
      "**/*.spec.js",
    ],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: ["./tsconfig.json"],
      },
      globals: {
        // DRY: Use extracted Jest globals
        ...jestGlobals,
      },
    },
    plugins: {
      jest,
    },
    rules: {
      // Jest recommended rules
      ...jest.configs.recommended.rules,
      // === DRY: Use extracted rule sets for tests ===
      ...relaxedTypescriptRules,
      // Still enforce no var in tests
      "no-var": "error",
    },
  },
  {
    files: ["**/*.d.ts"],
    rules: {
      // === DRY: Use extracted type definition rules ===
      ...typeDefinitionRules,
      "no-var": "error", // Still enforce no var in type files
    },
  },
  {
    files: ["*.config.js", "*.config.ts", "eslint.config.js"],
    rules: {
      // === DRY: Use extracted config file rules ===
      ...configFileTypescriptRules,
      ...strictFormattingRules,
      // Allow imports in config files
      "unicorn/prefer-module": "off",
      "import/no-anonymous-default-export": "off",
    },
  },
];
