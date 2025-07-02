/**
 * Type declarations for test utilities and global test objects
 */

declare global {
  // eslint-disable-next-line no-var
  var testConfig: {
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
  };

  // eslint-disable-next-line no-var
  var testUtils: {
    enableConsole: () => void;
    disableConsole: () => void;
    createMockMCPRequest: (method: string, params?: any) => any;
    createMockDatabaseUrl: (config: any) => string;
  };
}

export {};
