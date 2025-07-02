/**
 * Shared unused variables and imports rules for ESLint configuration
 *
 * These rules handle unused imports and variables consistently across
 * the project using the unused-imports plugin.
 */

export const unusedVariablesRules = {
  // === Unused imports and variables ===
  "no-unused-vars": "off", // Turn off base rule
  "@typescript-eslint/no-unused-vars": "off", // Turn off in favor of unused-imports
  "unused-imports/no-unused-imports": "error",
  "unused-imports/no-unused-vars": [
    "error",
    {
      vars: "all",
      varsIgnorePattern: "^_",
      args: "after-used",
      argsIgnorePattern: "^_",
    },
  ],
};

export const testUnusedVariablesRules = {
  // More lenient for test files
  "no-unused-vars": "off",
  "@typescript-eslint/no-unused-vars": "off",
  "unused-imports/no-unused-imports": "error",
  "unused-imports/no-unused-vars": [
    "warn", // Warning instead of error for tests
    {
      vars: "all",
      varsIgnorePattern: "^_",
      args: "after-used",
      argsIgnorePattern: "^_",
    },
  ],
};
