/**
 * Shared formatting rules for ESLint configuration
 *
 * These rules define our core formatting standards that are applied
 * consistently across all file types in the project.
 */

export const basicFormattingRules = {
  // === Core formatting preferences ===
  quotes: [
    "error",
    "single",
    {
      avoidEscape: true,
      allowTemplateLiterals: true,
    },
  ],
  "comma-dangle": ["error", "never"], // No trailing commas
  semi: ["error", "always"], // Always require semicolons
  indent: ["error", 2, { SwitchCase: 1 }],
  "object-curly-spacing": ["error", "always"],
  "space-before-function-paren": [
    "error",
    {
      asyncArrow: "always",
      anonymous: "never",
      named: "never",
    },
  ],

  // === Code quality basics ===
  "no-var": "error", // Enforce const/let over var
  "prefer-const": "error",
  "prefer-template": "error",
  "object-shorthand": "error",

  // === Console and debugging ===
  "no-console": "off", // Allow console for this project
};

export const strictFormattingRules = {
  ...basicFormattingRules,
  // Stricter version for production code
  quotes: ["error", "single"], // Simpler quotes rule for config files
};
