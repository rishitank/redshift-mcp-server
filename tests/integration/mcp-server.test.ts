/**
 * Integration tests for Redshift MCP Server
 *
 * Tests the complete MCP server functionality with a real PostgreSQL container
 * that mocks Redshift behavior.
 */

import { spawn, ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
// eslint-disable-next-line n/no-unpublished-import
import { GenericContainer, StartedTestContainer } from "testcontainers";

// Type definitions for MCP integration tests
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
    resources?: Array<{
      uri: string;
      name: string;
      mimeType: string;
    }>;
    tools?: Array<{
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
    }>;
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

interface QueryResult {
  rows: Array<Record<string, unknown>>;
  executionTime: number;
  rowCount: number;
}

describe("MCP Server Integration Tests", () => {
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

    // Connect to database and set up schema
    client = new Client({ connectionString: databaseUrl });
    await client.connect();

    // Load and execute setup scripts
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

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, 60_000);

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill();
    }
    if (client) {
      await client.end();
    }
    if (container) {
      await container.stop();
    }
  });

  describe("Resource Listing", () => {
    test("should list all available resources", async () => {
      const request = {
        jsonrpc: "2.0",
        id: 1,
        method: "resources/list",
      };

      const response = await sendMCPRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result?.resources).toBeDefined();
      expect(Array.isArray(response.result?.resources)).toBe(true);

      const resources = response.result?.resources || [];

      // Check for new resource types
      const queryHistory = resources.find((r) => r.name === "Query History");
      const permissions = resources.find((r) => r.name === "User Permissions");
      const dependencies = resources.filter((r) =>
        r.name.includes("Dependencies"),
      );

      expect(queryHistory).toBeDefined();
      expect(permissions).toBeDefined();
      expect(dependencies.length).toBeGreaterThan(0);
    });

    test("should include schema and table resources", async () => {
      const request = {
        jsonrpc: "2.0",
        id: 2,
        method: "resources/list",
      };

      const response = await sendMCPRequest(request);
      const resources = response.result?.resources || [];

      // Check for schema resources
      const schemaResources = resources.filter((r) =>
        r.name.startsWith("Schema:"),
      );
      expect(schemaResources.length).toBeGreaterThan(0);

      // Check for table resources
      const tableSchemas = resources.filter((r) =>
        r.name.startsWith("Table Schema:"),
      );
      const sampleData = resources.filter((r) =>
        r.name.startsWith("Sample Data:"),
      );
      const statistics = resources.filter((r) =>
        r.name.startsWith("Statistics:"),
      );

      expect(tableSchemas.length).toBeGreaterThan(0);
      expect(sampleData.length).toBeGreaterThan(0);
      expect(statistics.length).toBeGreaterThan(0);
    });
  });

  describe("Tool Listing", () => {
    test("should list all available tools", async () => {
      const request = {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/list",
      };

      const response = await sendMCPRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result?.tools).toBeDefined();
      expect(Array.isArray(response.result?.tools)).toBe(true);

      const tools = response.result?.tools || [];
      const toolNames = tools.map((t) => t.name);

      // Check for original tools
      expect(toolNames).toContain("query");
      expect(toolNames).toContain("describe_table");
      expect(toolNames).toContain("find_column");

      // Check for new tools
      expect(toolNames).toContain("analyze_query");
      expect(toolNames).toContain("get_table_lineage");
      expect(toolNames).toContain("check_permissions");
    });
  });

  describe("Enhanced Query Tool", () => {
    test("should execute safe queries successfully", async () => {
      const request = {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "query",
          arguments: {
            sql: "SELECT name, email FROM public.users LIMIT 3",
          },
        },
      };

      const response = await sendMCPRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result?.isError).toBe(false);
      expect(response.result?.content).toBeDefined();
      expect(response.result?.content?.[0]?.type).toBe("text");

      const result = JSON.parse(
        response.result?.content?.[0]?.text || "{}",
      ) as QueryResult;
      expect(result.rows).toBeDefined();
      expect(result.executionTime).toBeDefined();
      expect(result.rowCount).toBeDefined();
    });

    test("should block dangerous queries", async () => {
      const request = {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "query",
          arguments: {
            sql: "DROP TABLE users",
          },
        },
      };

      const response = await sendMCPRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result?.isError).toBe(true);
      expect(response.result?.content?.[0]?.text).toContain(
        "Security validation failed",
      );
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
