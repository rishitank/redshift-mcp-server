/**
 * Integration tests for new MCP resources
 *
 * Tests the new resource types added to the MCP server:
 * - Query History
 * - User Permissions
 * - Table Dependencies
 */

// Jest globals are available implicitly
import { spawn, ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
// eslint-disable-next-line n/no-unpublished-import
import { GenericContainer, StartedTestContainer } from "testcontainers";

// Type definitions for new resources tests
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

interface QueryHistoryItem {
  query_id: number;
  user_name: string;
  database: string;
  query_text: string;
  start_time: string;
  status: string;
}

interface UserPermission {
  schema_name: string;
  table_name: string;
  privilege_type: string;
  grantor: string;
}

interface TableDependency {
  schema_name: string;
  table_name: string;
  referenced_schema: string;
  referenced_table: string;
  constraint_name: string;
}

describe("New MCP Resources Integration Tests", () => {
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

  describe("Query History Resource", () => {
    test("should read query history resource", async () => {
      // First get the resource list to find the query history URI
      const listRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "resources/list",
      };

      const listResponse = await sendMCPRequest(listRequest);
      const queryHistoryResource = listResponse.result?.resources?.find(
        (r) => r.name === "Query History",
      );

      expect(queryHistoryResource).toBeDefined();

      // Now read the query history resource
      const readRequest: MCPRequest = {
        jsonrpc: "2.0",
        id: 2,
        method: "resources/read",
        params: {
          uri: queryHistoryResource?.uri || "",
        },
      };

      const readResponse = await sendMCPRequest(readRequest);

      expect(readResponse.result).toBeDefined();
      expect(readResponse.result?.content).toBeDefined();
      expect(readResponse.result?.content?.[0]?.type).toBe("text");

      const queryHistory = JSON.parse(
        readResponse.result?.content?.[0]?.text || "[]",
      ) as QueryHistoryItem[];
      expect(Array.isArray(queryHistory)).toBe(true);

      if (queryHistory.length > 0) {
        const query = queryHistory[0];
        expect(query?.query_id).toBeDefined();
        expect(query?.user_name).toBeDefined();
        expect(query?.database).toBeDefined();
        expect(query?.query_text).toBeDefined();
        expect(query?.start_time).toBeDefined();
        expect(query?.status).toBeDefined();
      }
    });
  });

  describe("User Permissions Resource", () => {
    test("should read user permissions resource", async () => {
      // Get resource list
      const listRequest = {
        jsonrpc: "2.0",
        id: 3,
        method: "resources/list",
      };

      const listResponse = await sendMCPRequest(listRequest);
      const permissionsResource = listResponse.result?.resources?.find(
        (r) => r.name === "User Permissions",
      );

      expect(permissionsResource).toBeDefined();

      // Read permissions resource
      const readRequest: MCPRequest = {
        jsonrpc: "2.0",
        id: 4,
        method: "resources/read",
        params: {
          uri: permissionsResource?.uri || "",
        },
      };

      const readResponse = await sendMCPRequest(readRequest);

      expect(readResponse.result).toBeDefined();
      expect(readResponse.result?.content).toBeDefined();

      const permissions = JSON.parse(
        readResponse.result?.content?.[0]?.text || "[]",
      ) as UserPermission[];
      expect(Array.isArray(permissions)).toBe(true);

      if (permissions.length > 0) {
        const permission = permissions[0];
        expect(permission?.schema_name).toBeDefined();
        expect(permission?.table_name).toBeDefined();
        expect(permission?.privilege_type).toBeDefined();
        expect(permission?.grantor).toBeDefined();
      }
    });
  });

  describe("Table Dependencies Resource", () => {
    test("should read table dependencies for orders table", async () => {
      // Get resource list
      const listRequest = {
        jsonrpc: "2.0",
        id: 5,
        method: "resources/list",
      };

      const listResponse = await sendMCPRequest(listRequest);
      const dependenciesResource = listResponse.result?.resources?.find(
        (r) => r.name === "Dependencies: public.orders",
      );

      expect(dependenciesResource).toBeDefined();

      // Read dependencies resource
      const readRequest: MCPRequest = {
        jsonrpc: "2.0",
        id: 6,
        method: "resources/read",
        params: {
          uri: dependenciesResource?.uri || "",
        },
      };

      const readResponse = await sendMCPRequest(readRequest);

      expect(readResponse.result).toBeDefined();
      expect(readResponse.result?.content).toBeDefined();

      const dependencies = JSON.parse(
        readResponse.result?.content?.[0]?.text || "[]",
      ) as TableDependency[];
      expect(Array.isArray(dependencies)).toBe(true);

      // Orders table should have foreign key to users table
      const foreignKeys = dependencies.filter((dep) =>
        dep.constraint_name?.includes("FOREIGN KEY"),
      );
      expect(foreignKeys.length).toBeGreaterThan(0);

      if (foreignKeys.length > 0) {
        const fk = foreignKeys[0];
        expect(fk?.schema_name).toBeDefined();
        expect(fk?.table_name).toBeDefined();
        expect(fk?.referenced_schema).toBeDefined();
        expect(fk?.referenced_table).toBeDefined();
        expect(fk?.constraint_name).toBeDefined();
      }
    });

    test("should read table dependencies for users table", async () => {
      const listRequest = {
        jsonrpc: "2.0",
        id: 7,
        method: "resources/list",
      };

      const listResponse = await sendMCPRequest(listRequest);
      const dependenciesResource = listResponse.result?.resources?.find(
        (r) => r.name === "Dependencies: public.users",
      );

      expect(dependenciesResource).toBeDefined();

      const readRequest: MCPRequest = {
        jsonrpc: "2.0",
        id: 8,
        method: "resources/read",
        params: {
          uri: dependenciesResource?.uri || "",
        },
      };

      const readResponse = await sendMCPRequest(readRequest);
      const dependencies = JSON.parse(
        readResponse.result?.content?.[0]?.text || "[]",
      ) as TableDependency[];

      // Users table should have primary key constraint
      const primaryKeys = dependencies.filter((dep) =>
        dep.constraint_name?.includes("PRIMARY KEY"),
      );
      expect(primaryKeys.length).toBeGreaterThan(0);
    });
  });

  describe("Enhanced Table Resources", () => {
    test("should read enhanced table schema with distribution keys", async () => {
      const listRequest = {
        jsonrpc: "2.0",
        id: 9,
        method: "resources/list",
      };

      const listResponse = await sendMCPRequest(listRequest);
      const schemaResource = listResponse.result?.resources?.find(
        (r) => r.name === "Table Schema: public.users",
      );

      expect(schemaResource).toBeDefined();

      const readRequest: MCPRequest = {
        jsonrpc: "2.0",
        id: 10,
        method: "resources/read",
        params: {
          uri: schemaResource?.uri || "",
        },
      };

      const readResponse = await sendMCPRequest(readRequest);
      const schema = JSON.parse(
        readResponse.result?.content?.[0]?.text || "[]",
      ) as Array<{
        column_name: string;
        data_type: string;
        ordinal_position: number;
        is_distkey: boolean;
        is_sortkey: boolean;
      }>;

      expect(Array.isArray(schema)).toBe(true);

      if (schema.length > 0) {
        const column = schema[0];
        expect(column?.column_name).toBeDefined();
        expect(column?.data_type).toBeDefined();
        expect(column?.ordinal_position).toBeDefined();
        expect(column?.is_distkey).toBeDefined();
        expect(column?.is_sortkey).toBeDefined();
      }
    });

    test("should read enhanced table statistics", async () => {
      const listRequest = {
        jsonrpc: "2.0",
        id: 11,
        method: "resources/list",
      };

      const listResponse = await sendMCPRequest(listRequest);
      const statsResource = listResponse.result?.resources?.find(
        (r) => r.name === "Statistics: public.users",
      );

      expect(statsResource).toBeDefined();

      const readRequest: MCPRequest = {
        jsonrpc: "2.0",
        id: 12,
        method: "resources/read",
        params: {
          uri: statsResource?.uri || "",
        },
      };

      const readResponse = await sendMCPRequest(readRequest);
      const stats = JSON.parse(
        readResponse.result?.content?.[0]?.text || "[]",
      ) as Array<{
        table_name: string;
        total_size_mb: number;
        row_count: number;
        diststyle: string;
      }>;

      expect(Array.isArray(stats)).toBe(true);

      if (stats.length > 0) {
        const stat = stats[0];
        expect(stat?.table_name).toBeDefined();
        expect(stat?.total_size_mb).toBeDefined();
        expect(stat?.row_count).toBeDefined();
        expect(stat?.diststyle).toBeDefined();
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
