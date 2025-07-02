/**
 * Shared global variable definitions for ESLint configuration
 *
 * These globals are available in different environments and should be
 * recognized by ESLint to avoid undefined variable errors.
 */

export const nodeGlobals = {
  // Node.js globals
  process: "readonly",
  console: "readonly",
  Buffer: "readonly",
  global: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  setTimeout: "readonly",
  setInterval: "readonly",
  clearTimeout: "readonly",
  clearInterval: "readonly",
  URL: "readonly",
  performance: "readonly",
  // Fetch API (Node.js 18+)
  fetch: "readonly",
  AbortSignal: "readonly",
  AbortController: "readonly",
};

export const jestGlobals = {
  // Jest testing globals
  describe: "readonly",
  test: "readonly",
  it: "readonly",
  expect: "readonly",
  beforeAll: "readonly",
  afterAll: "readonly",
  beforeEach: "readonly",
  afterEach: "readonly",
  jest: "readonly",
};
