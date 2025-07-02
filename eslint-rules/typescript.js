/**
 * Shared TypeScript-specific rules for ESLint configuration
 *
 * These rules define TypeScript-specific linting standards including
 * type safety, code quality, and complexity limits.
 */

export const typescriptRules = {
  // === TypeScript type safety ===
  "@typescript-eslint/no-explicit-any": "warn",
  "@typescript-eslint/explicit-function-return-type": "off",
  "@typescript-eslint/explicit-module-boundary-types": "off",

  // === Code quality and complexity ===
  complexity: ["warn", 15],
  "max-lines": ["warn", 500],
  "max-lines-per-function": ["warn", 150],
  "max-depth": ["warn", 4],
};

export const relaxedTypescriptRules = {
  // More lenient for test files
  "@typescript-eslint/no-explicit-any": "off",
  "@typescript-eslint/no-non-null-assertion": "off",
  complexity: ["warn", 25], // Higher complexity allowed in tests
  "max-lines": ["warn", 1000],
  "max-lines-per-function": ["warn", 300],
  "max-depth": "off",
  "no-unused-expressions": "off", // Allow expect().toBe() patterns
};

export const configFileTypescriptRules = {
  // Very lenient for config files
  "@typescript-eslint/no-explicit-any": "off",
  "max-lines": "off",
  complexity: "off",
  "max-lines-per-function": "off",
};

export const typeDefinitionRules = {
  // Special rules for .d.ts files
  "@typescript-eslint/no-explicit-any": "off",
  "@typescript-eslint/no-unused-vars": "off",
};
