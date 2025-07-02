import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ServerCapabilities,
  Implementation,
} from "@modelcontextprotocol/sdk/types";
import { Pool, QueryResult, QueryResultRow } from "pg";
import sql, { raw } from "sql-template-tag";
import {
  APP_VERSION,
  PACKAGE_NAME,
  MIME_TYPES,
  RESOURCE_PATHS,
  PROMPT_NAMES,
  SPECTRUM_CONFIG,
} from "./constants";
import { setGlobalLoggingManager } from "./database";
import { handleToolCall, TOOL_DEFINITIONS } from "./handlers";
import { initializeGlobalLogger } from "./logging/global-logger";
import { loadWinstonLoggingConfig } from "./logging/config-loader";
import { WinstonLoggingManager } from "./logging/winston-manager";

interface RedshiftSchema {
  schema_name: string;
}

interface RedshiftTable {
  table_name: string;
}

interface RedshiftColumn {
  column_name: string;
  data_type: string;
  character_maximum_length?: number | null;
  numeric_precision?: number | null;
  numeric_scale?: number | null;
  is_nullable: string;
  column_default?: string | null;
  ordinal_position: number;
  is_distkey: boolean;
  is_sortkey: boolean;
}

interface RedshiftStatistics {
  database: string;
  schema: string;
  table_id: number;
  table_name: string;
  size: number;
  percent_used: number;
  row_count: number;
  encoded: boolean;
  diststyle: string;
  sortkey1: string;
  max_varchar: number;
  create_time: string;
}

interface SampleDataRow {
  [key: string]: unknown;
  email?: string;
  phone?: string;
}

const serverInfo: Implementation = {
  name: PACKAGE_NAME,
  version: APP_VERSION,
};

const serverCapabilities: ServerCapabilities = {
  resources: {
    subscribe: true,
    listChanged: true,
  },
  tools: {
    listChanged: true,
  },
  logging: {},
  prompts: {
    listChanged: true,
  },
};

const server = new Server(serverInfo, { capabilities: serverCapabilities });

// Initialize Winston-based logging system
const winstonConfig = loadWinstonLoggingConfig();
const loggingManager = new WinstonLoggingManager(winstonConfig);

const databaseUrl: string | undefined = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Create resource URL without sensitive info
const resourceBaseUrl: URL = new URL(databaseUrl);
console.warn(resourceBaseUrl);
const sslEnabled: boolean = resourceBaseUrl.searchParams.get("ssl") === "true";

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: sslEnabled ? { rejectUnauthorized: true } : false,
});

const { SCHEMA, SAMPLE, STATISTICS } = RESOURCE_PATHS;

// List available resources (schemas and tables)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const client = await pool.connect();
  try {
    // First get all schemas (excluding system schemas)
    const schemasResult = await client.query<RedshiftSchema>(sql`
      SELECT
        nspname as schema_name
      FROM
        pg_namespace
      WHERE
        nspname NOT LIKE 'pg_%'
        AND nspname NOT IN ('information_schema', 'sys')
        AND nspname NOT LIKE 'stl%'
        AND nspname NOT LIKE 'stv%'
        AND nspname NOT LIKE 'svv%'
        AND nspname NOT LIKE 'svl%'
      ORDER BY
        schema_name
    `);

    const resources: {
      uri: string;
      mimeType: string;
      name: string;
    }[] = [];

    // Add schemas as resources
    for (const schema of schemasResult.rows) {
      resources.push({
        uri: new URL(`${SCHEMA}/${schema.schema_name}`, resourceBaseUrl).href,
        mimeType: MIME_TYPES.JSON,
        name: `Schema: ${schema.schema_name}`,
      });

      // Get tables for this schema
      const tablesResult = await client.query<RedshiftTable>(sql`
        SELECT
          table_name
        FROM
          SVV_TABLES
        WHERE
          table_schema = ${schema.schema_name}
        ORDER BY
          table_name
      `);

      // Add tables as resources with different resource types
      for (const table of tablesResult.rows) {
        // Add all table resources at once
        resources.push(
          {
            uri: new URL(
              `${schema.schema_name}/${table.table_name}/${SCHEMA}`,
              resourceBaseUrl,
            ).href,
            mimeType: MIME_TYPES.JSON,
            name: `Table Schema: ${schema.schema_name}.${table.table_name}`,
          },
          {
            uri: new URL(
              `${schema.schema_name}/${table.table_name}/${SAMPLE}`,
              resourceBaseUrl,
            ).href,
            mimeType: MIME_TYPES.JSON,
            name: `Sample Data: ${schema.schema_name}.${table.table_name}`,
          },
          {
            uri: new URL(
              `${schema.schema_name}/${table.table_name}/${STATISTICS}`,
              resourceBaseUrl,
            ).href,
            mimeType: MIME_TYPES.JSON,
            name: `Statistics: ${schema.schema_name}.${table.table_name}`,
          },
        );
      }
    }

    return {
      resources,
    };
  } finally {
    client.release();
  }
});

// Read a specific resource
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const resourceUrl = new URL(request.params.uri);
  const pathComponents = resourceUrl.pathname.split("/");

  // Check if this is a schema listing
  if (pathComponents.length === 2 && pathComponents[0] === SCHEMA) {
    const schemaName = pathComponents[1];
    const client = await pool.connect();

    try {
      const result = await client.query<RedshiftTable>(sql`
        SELECT
          table_name
        FROM
          SVV_TABLES
        WHERE
          table_schema = ${schemaName}
        ORDER BY
          table_name
      `);

      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: MIME_TYPES.JSON,
            text: JSON.stringify(result.rows, null, 2),
          },
        ],
      };
    } finally {
      client.release();
    }
  }

  // Handle table-specific resources
  if (pathComponents.length === 3) {
    const schemaName = pathComponents[0];
    const tableName = pathComponents[1];
    const resourceType = pathComponents[2];

    const client = await pool.connect();
    try {
      let result: QueryResult<QueryResultRow>;

      // Schema resource - column definitions
      switch (resourceType) {
        case SCHEMA: {
          result = await client.query<RedshiftColumn>(sql`
            SELECT DISTINCT
              c.column_name,
              c.data_type,
              c.character_maximum_length,
              c.numeric_precision,
              c.numeric_scale,
              c.is_nullable,
              c.ordinal_position,
              c.column_default,
              c.ordinal_position,
              a.attisdistkey as is_distkey,
              BOOL (COALESCE(a.attsortkeyord, 0)) as is_sortkey
            FROM
              SVV_COLUMNS c
              INNER JOIN pg_class r ON r.relname = c.table_name
              INNER JOIN pg_attribute a ON a.attrelid = r.oid
              AND a.attname = c.column_name
            WHERE
              table_schema = ${schemaName}
              AND table_name = ${tableName}
            ORDER BY
              ordinal_position
          `);

          break;
        }
        case SAMPLE: {
          // Use a parameterized query approach that's safe
          result = await client.query(sql`
            SELECT
              *
            FROM
              ${raw(`"${schemaName}"."${tableName}"`)}
            LIMIT
              5
          `);
          // redact PII
          const typedRows = result.rows as SampleDataRow[];
          result.rows = typedRows.map((row: SampleDataRow): SampleDataRow => {
            const newRow = { ...row };
            if ("email" in newRow) {
              newRow.email = "REDACTED";
            }
            if ("phone" in newRow) {
              newRow.phone = "REDACTED";
            }
            return newRow;
          });

          break;
        }
        case STATISTICS: {
          result = await client.query<RedshiftStatistics>(sql`
            SELECT
              database,
              schema,
              table_id,
              "table" as table_name,
              size as total_size_mb,
              pct_used as percent_used,
              tbl_rows as row_count,
              encoded,
              diststyle,
              sortkey1,
              max_varchar,
              create_time
            FROM
              SVV_TABLE_INFO
            WHERE
              schema = ${schemaName}
              AND "table" = ${tableName}
          `);

          break;
        }
        default: {
          throw new Error(`Unknown resource type: ${resourceType}`);
        }
      }

      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: MIME_TYPES.JSON,
            text: JSON.stringify(result?.rows ?? [], null, 2),
          },
        ],
      };
    } finally {
      client.release();
    }
  }

  throw new Error("Invalid resource URI");
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, () => {
  return {
    tools: TOOL_DEFINITIONS,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  return handleToolCall(
    pool,
    request.params.name,
    request.params.arguments || {},
  );
});

// List available prompts
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: PROMPT_NAMES.ANALYZE_QUERY_PERFORMANCE,
        description:
          "Generate a prompt to analyze SQL query performance and optimization",
        arguments: [
          {
            name: "query",
            description: "SQL query to analyze",
            required: true,
          },
          {
            name: "context",
            description: "Additional context about the query purpose",
            required: false,
          },
        ],
      },
      {
        name: PROMPT_NAMES.EXPLORE_SCHEMA,
        description:
          "Generate a prompt to explore and understand database schema",
        arguments: [
          {
            name: "schema",
            description: "Schema name to explore",
            required: true,
          },
          {
            name: "focus",
            description:
              "Specific aspect to focus on (tables, relationships, etc.)",
            required: false,
          },
        ],
      },
      {
        name: PROMPT_NAMES.TROUBLESHOOT_REDSHIFT,
        description:
          "Generate a prompt to troubleshoot Redshift performance issues",
        arguments: [
          {
            name: "issue",
            description: "Description of the performance issue",
            required: true,
          },
          {
            name: "table",
            description: "Specific table involved (optional)",
            required: false,
          },
        ],
      },
    ],
  };
});

// Get specific prompt
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name as PROMPT_NAMES) {
    case PROMPT_NAMES.ANALYZE_QUERY_PERFORMANCE: {
      const query = args?.query as string;
      const context = (args?.context as string) || "";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please analyze this Redshift SQL query for performance optimization:

Query:
\`\`\`sql
${query}
\`\`\`

${context ? `Context: ${context}` : ""}

Please provide:
1. Performance analysis and potential bottlenecks
2. Optimization recommendations
3. Index suggestions if applicable
4. Distribution key recommendations
5. Sort key recommendations
6. Query rewriting suggestions if needed

Focus on Redshift-specific optimizations like distribution styles, sort keys, and columnar storage benefits.`,
            },
          },
        ],
      };
    }
    case PROMPT_NAMES.EXPLORE_SCHEMA: {
      const schema = args?.schema as string;
      const focus = (args?.focus as string) || "overview";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please help me explore and understand the "${schema}" schema in this Redshift database.

Focus area: ${focus}

Please provide:
1. Schema overview and purpose
2. Key tables and their relationships
3. Data flow patterns
4. Common query patterns for this schema
5. Performance considerations
6. Best practices for working with this schema

Use the available MCP tools to gather information about tables, columns, and relationships in this schema.`,
            },
          },
        ],
      };
    }
    case PROMPT_NAMES.TROUBLESHOOT_REDSHIFT: {
      const issue = args?.issue as string;
      const table = (args?.table as string) || "";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Help me troubleshoot this Redshift performance issue:

Issue: ${issue}
${table ? `Table involved: ${table}` : ""}

Please help me:
1. Identify potential root causes
2. Suggest diagnostic queries to run
3. Recommend performance monitoring approaches
4. Provide optimization strategies
5. Suggest preventive measures

Use the available MCP tools to gather relevant information about the database structure and query patterns.`,
            },
          },
        ],
      };
    }
    default: {
      throw new Error(`Unknown prompt: ${name}`);
    }
  }
});

async function runServer(): Promise<void> {
  const transport = new StdioServerTransport();

  // Initialize Winston logging system
  await loggingManager.initialize();

  // Set up MCP transport with server instance
  loggingManager.setMCPServer(server);

  // Initialize global logger for use throughout codebase
  await initializeGlobalLogger();

  // Set global logging manager for database operations
  setGlobalLoggingManager(loggingManager);

  // Log server startup
  await loggingManager.info("Redshift MCP Server starting up", {
    version: APP_VERSION,
    spectrumEnabled: SPECTRUM_CONFIG.ENABLED,
    debugLogging: SPECTRUM_CONFIG.DEBUG_LOGGING,
    component: "server",
  });

  await server.connect(transport);

  // Log successful startup
  await loggingManager.info("Redshift MCP Server successfully connected", {
    transport: "stdio",
    capabilities: Object.keys(serverCapabilities),
    component: "server",
  });

  // === HEALTH MONITORING INTEGRATION ===
  // Perform initial health check
  const initialHealthStatus = await loggingManager.getHealthStatus();
  await loggingManager.info("Initial logging backend health check", {
    healthStatus: initialHealthStatus,
    component: "health-monitor",
  });

  // Set up periodic health monitoring (every 2 minutes)
  const healthCheckInterval = setInterval(async () => {
    try {
      const healthStatus = await loggingManager.getHealthStatus();
      const unhealthyBackends = Object.entries(healthStatus)
        .filter(([, healthy]) => !healthy)
        .map(([name]) => name);

      await (unhealthyBackends.length > 0
        ? loggingManager.warning("Some logging backends are unhealthy", {
            healthStatus,
            unhealthyBackends,
            component: "health-monitor",
          })
        : loggingManager.debug("All logging backends healthy", {
            healthStatus,
            component: "health-monitor",
          }));
    } catch (error) {
      await loggingManager.error("Health check failed", error, {
        component: "health-monitor",
      });
    }
  }, 120_000); // Check every 2 minutes

  // === GRACEFUL SHUTDOWN INTEGRATION ===
  const gracefulShutdown = async (signal: string) => {
    await loggingManager.info(
      `Received ${signal}, initiating graceful shutdown`,
      {
        signal,
        component: "shutdown",
      },
    );

    // Clear health monitoring interval
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
    }

    try {
      // Close logging manager (flushes and closes all backends)
      await loggingManager.close();

      // Close database pool
      await pool.end();

      await loggingManager.info("Graceful shutdown completed", {
        signal,
        component: "shutdown",
      });
    } catch (error) {
      // Use console.error here as logging manager may be closed
      console.error("Error during graceful shutdown:", error);
    }

    process.exit(0);
  };

  // Register shutdown handlers
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2")); // For nodemon
}

try {
  await runServer();
} catch (error) {
  // Use console.error for startup failures before logging is initialized
  console.error("Failed to start server:", error);
  throw error;
}
