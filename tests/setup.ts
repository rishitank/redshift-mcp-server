/**
 * Global test setup for Redshift MCP Server tests
 *
 * This file configures the testing environment with:
 * - Extended timeouts for container operations
 * - Global test utilities
 * - Environment variable setup
 */

// Extend Jest timeout for container operations
jest.setTimeout(60_000);

// Type definition for global test config
interface TestConfig {
  database: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
  mcp: {
    timeout: number;
    maxRetries: number;
  };
}

// Global test configuration
const testConfig: TestConfig = {
  database: {
    host: "localhost",
    port: 5432,
    database: "test_redshift",
    username: "test_user",
    password: "test_password",
  },
  mcp: {
    timeout: 5000,
    maxRetries: 3,
  },
};

// Assign to global
(globalThis as typeof globalThis & { testConfig: TestConfig }).testConfig =
  testConfig;

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress console output during tests unless explicitly needed
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Type definition for global test utilities
interface TestUtils {
  enableConsole: () => void;
  disableConsole: () => void;
  createMockMCPRequest: (
    method: string,
    params?: Record<string, unknown>,
  ) => Record<string, unknown>;
  createMockDatabaseUrl: (config: TestConfig["database"]) => string;
}

// Global test utilities
const testUtils: TestUtils = {
  enableConsole: () => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  },

  disableConsole: () => {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  },

  createMockMCPRequest: (method: string, params?: Record<string, unknown>) => ({
    jsonrpc: "2.0" as const,
    id: Math.floor(Math.random() * 1000),
    method,
    params,
  }),

  createMockDatabaseUrl: (config: TestConfig["database"]) => {
    const { host, port, database, username, password } = config;
    return `postgresql://${username}:${password}@${host}:${port}/${database}?ssl=false`;
  },
};

// Assign to global
(globalThis as typeof globalThis & { testUtils: TestUtils }).testUtils =
  testUtils;
