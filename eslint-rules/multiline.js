/**
 * Shared multiline formatting rules for ESLint configuration
 *
 * These rules enforce consistent multiline formatting for objects,
 * arrays, function parameters, and import statements.
 */

export const multilineFormattingRules = {
  // === Function formatting ===
  "function-paren-newline": ["error", "multiline-arguments"],
  "function-call-argument-newline": ["error", "consistent"],

  // === Object formatting ===
  "object-property-newline": [
    "error",
    {
      allowAllPropertiesOnSameLine: false,
      allowMultiplePropertiesPerLine: false,
    },
  ],
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
        consistent: true,
      },
      ExportDeclaration: {
        multiline: true,
        minProperties: 4,
        consistent: true,
      },
    },
  ],

  // === Array formatting ===
  "array-element-newline": [
    "error",
    {
      multiline: true,
      minItems: 4,
    },
  ],
  "array-bracket-newline": [
    "error",
    {
      multiline: true,
      minItems: 4,
    },
  ],
};

export const relaxedMultilineRules = {
  // More relaxed version for test files
  "function-paren-newline": ["warn", "multiline-arguments"],
  "function-call-argument-newline": ["warn", "consistent"],
  "object-property-newline": "off", // Allow flexibility in tests
  "array-element-newline": "off", // Allow flexibility in tests
};
