export default {
  // TypeScript files (preferred) - lint and type check
  "*.ts": ["eslint --fix", "tsc --noEmit"],

  // JavaScript files (fallback only) - lint only
  "*.js": ["eslint --fix"],

  // All text files for formatting
  "*.{ts,js,json,md,yml,yaml}": ["prettier --write"],
};
