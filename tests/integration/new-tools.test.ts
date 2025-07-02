/**
 * Integration tests for new MCP tools
 *
 * Tests the new tools added to the MCP server:
 * - analyze_query
 * - get_table_lineage
 * - check_permissions
 */

import { spawn, ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
// eslint-disable-next-line n/no-unpublished-import
import { GenericContainer, StartedTestContainer } from "testcontainers";

// Type definitions for new tools tests
interface MCPRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: number;
  result?: {
    content?: Array<{
      type: string;
      text: string;
    }>;
    isError?: boolean;
  };
  error?: {
    code: number;
    message: string;
  };
}

interface QueryAnalysis {
  query_text: string;
  execution_plan: string;
  recommendations: string[];
  potential_issues: string[];
}

interface TableLineage {
  target_table: {
    schema: string;
    table: string;
  };
  dependencies: Array<{
    schema: string;
    table: string;
    constraint_type: string;
  }>;
  referenced_by: Array<{
    schema: string;
    table: string;
    constraint_type: string;
  }>;
}

interface PermissionCheck {
  operation: string;
  schema: string;
  permissions: Array<{
    privilege_type: string;
    is_grantable: boolean;
  }>;
}

describe("New MCP Tools Integration Tests", () => {
  let container: StartedTestContainer;
  let client: Client;
  let serverProcess: ChildProcess;
  let databaseUrl: string;

  beforeAll(async () => {
    // Start PostgreSQL container
    container = await new GenericContainer("postgres:15-alpine")
      .withEnvironment({
        POSTGRES_DB: "test_redshift",
        POSTGRES_USER: "test_user",
        POSTGRES_PASSWORD: "test_password",
      })
      .withExposedPorts(5432)
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(5432);
    databaseUrl = `postgresql://test_user:test_password@${host}:${port}/test_redshift?ssl=false`;

    // Connect and setup database
    client = new Client({ connectionString: databaseUrl });
    await client.connect();

    // Load setup scripts
    const initScript = readFileSync(
      path.join(__dirname, "../fixtures/init-test-db.sql"),
      "utf8",
    );
    const schemaScript = readFileSync(
      path.join(__dirname, "../fixtures/mock-redshift-schema.sql"),
      "utf8",
    );
    const dataScript = readFileSync(
      path.join(__dirname, "../fixtures/test-data.sql"),
      "utf8",
    );

    await client.query(initScript);
    await client.query(schemaScript);
    await client.query(dataScript);

    // Start MCP server
    serverProcess = spawn(
      "node",
      [path.join(__dirname, "../../dist/index.js")],
      {
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, 60_000);

  afterAll(async () => {
    if (serverProcess) serverProcess.kill();
    if (client) await client.end();
    if (container) await container.stop();
  });

  describe("analyze_query tool", () => {
    test("should analyze a safe query successfully", async () => {
      const request = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "analyze_query",
          arguments: {
            sql: "SELECT name, email FROM public.users WHERE created_at > '2024-01-01' ORDER BY created_at LIMIT 10",
          },
        },
      };

      const response = await sendMCPRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result?.isError).toBe(false);

      const analysis = JSON.parse(
        response.result?.content?.[0]?.text || "{}",
      ) as QueryAnalysis;
      expect(analysis.query_text).toBeDefined();
      expect(analysis.execution_plan).toBeDefined();
      expect(analysis.recommendations).toBeDefined();
      expect(analysis.potential_issues).toBeDefined();
      expect(Array.isArray(analysis.recommendations)).toBe(true);
      expect(Array.isArray(analysis.potential_issues)).toBe(true);
    });

    test("should provide recommendations for SELECT *", async () => {
      const request = {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "analyze_query",
          arguments: {
            sql: "SELECT * FROM public.users",
          },
        },
      };

      const response = await sendMCPRequest(request);
      const analysis = JSON.parse(
        response.result?.content?.[0]?.text || "{}",
      ) as QueryAnalysis;

      expect(
        analysis.recommendations?.some((rec: string) =>
          rec.includes("SELECT *"),
        ),
      ).toBe(true);
    });

    test("should block dangerous queries in analysis", async () => {
      const request = {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "analyze_query",
          arguments: {
            sql: "DROP TABLE users",
          },
        },
      };

      const response = await sendMCPRequest(request);

      expect(response.result?.isError).toBe(true);
      expect(response.result?.content?.[0]?.text).toContain(
        "Security validation failed",
      );
    });
  });

  describe("get_table_lineage tool", () => {
    test("should get lineage for a table with dependencies", async () => {
      const request = {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "get_table_lineage",
          arguments: {
            schema: "public",
            table: "orders",
          },
        },
      };

      const response = await sendMCPRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result?.isError).toBe(false);

      const lineage = JSON.parse(
        response.result?.content?.[0]?.text || "{}",
      ) as TableLineage;
      expect(lineage.target_table).toBeDefined();
      expect(lineage.target_table?.schema).toBe("public");
      expect(lineage.target_table?.table).toBe("orders");
      expect(lineage.dependencies).toBeDefined();
      expect(lineage.referenced_by).toBeDefined();
      expect(Array.isArray(lineage.dependencies)).toBe(true);
      expect(Array.isArray(lineage.referenced_by)).toBe(true);
    });

    test("should get lineage for users table (referenced by orders)", async () => {
      const request = {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "get_table_lineage",
          arguments: {
            schema: "public",
            table: "users",
          },
        },
      };

      const response = await sendMCPRequest(request);
      const lineage = JSON.parse(
        response.result?.content?.[0]?.text || "{}",
      ) as TableLineage;

      // Users table should be referenced by orders table
      expect(lineage.referenced_by?.length).toBeGreaterThan(0);
    });

    test("should sanitize schema and table names", async () => {
      const request = {
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: {
          name: "get_table_lineage",
          arguments: {
            schema: "public; DROP TABLE",
            table: "users; --",
          },
        },
      };

      const response = await sendMCPRequest(request);

      // Should not error due to sanitization
      expect(response.result).toBeDefined();
    });
  });

  describe("check_permissions tool", () => {
    test("should check permissions for a schema", async () => {
      const request = {
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: {
          name: "check_permissions",
          arguments: {
            operation: "SELECT",
            schema: "public",
          },
        },
      };

      const response = await sendMCPRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result?.isError).toBe(false);

      const permissions = JSON.parse(
        response.result?.content?.[0]?.text || "{}",
      ) as PermissionCheck;
      expect(permissions.operation).toBe("SELECT");
      expect(permissions.schema).toBe("public");
      expect(permissions.permissions).toBeDefined();
      expect(Array.isArray(permissions.permissions)).toBe(true);
    });

    test("should check permissions for a specific table", async () => {
      const request = {
        jsonrpc: "2.0",
        id: 8,
        method: "tools/call",
        params: {
          name: "check_permissions",
          arguments: {
            operation: "SELECT",
            schema: "public",
            table: "users",
          },
        },
      };

      const response = await sendMCPRequest(request);
      const permissions = JSON.parse(
        response.result?.content?.[0]?.text || "{}",
      ) as PermissionCheck & { table: string };

      expect(permissions.table).toBe("users");
      expect(permissions.permissions?.length).toBeGreaterThan(0);
    });

    test("should handle different operation types", async () => {
      const operations = ["SELECT", "INSERT", "UPDATE", "DELETE"];

      for (const operation of operations) {
        const request = {
          jsonrpc: "2.0",
          id: 9,
          method: "tools/call",
          params: {
            name: "check_permissions",
            arguments: {
              operation,
              schema: "public",
            },
          },
        };

        const response = await sendMCPRequest(request);
        const permissions = JSON.parse(
          response.result?.content?.[0]?.text || "{}",
        ) as PermissionCheck;

        expect(permissions.operation).toBe(operation);
      }
    });
  });

  // Helper function to send MCP requests
  async function sendMCPRequest(request: MCPRequest): Promise<MCPResponse> {
    return new Promise<MCPResponse>((resolve, reject) => {
      const requestStr = `${JSON.stringify(request)}\n`;

      let responseData = "";
      const onData = (data: Buffer): void => {
        responseData += data.toString();
        try {
          const response = JSON.parse(responseData) as MCPResponse;
          serverProcess.stdout?.off("data", onData);
          resolve(response);
        } catch {
          // Continue collecting data
        }
      };

      serverProcess.stdout?.on("data", onData);
      serverProcess.stdin?.write(requestStr);

      setTimeout(() => {
        serverProcess.stdout?.off("data", onData);
        reject(new Error("Request timeout"));
      }, 10_000);
    });
  }
});
