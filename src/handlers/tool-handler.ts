/**
 * Tool Handler Module for Redshift MCP Server
 *
 * This module provides MCP tool request handlers for executing various
 * database operations and analysis tools.
 */

import { Pool, PoolClient } from "pg";
import { TOOL_RESPONSE_TYPES, TOOL_NAMES } from "../constants";
import { DatabaseOperations } from "../database";
import { SecurityValidator } from "../security";
import {
  QueryToolArgs,
  DescribeTableArgs,
  FindColumnArgs,
  AnalyzeQueryArgs,
  GetTableLineageArgs,
  CheckPermissionsArgs,
  DatabaseRow,
  QueryAnalysis,
  TableLineage,
} from "../types";

/**
 * MCP tool response interface
 */
interface ToolResponse {
  content: Array<{ type: string; text: string }>;
  isError: boolean;
}

/**
 * Tool definitions for MCP server
 */
export const TOOL_DEFINITIONS = [
  {
    name: TOOL_NAMES.QUERY,
    description: "Run a read-only SQL query against Redshift",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string" },
      },
      required: ["sql"],
    },
  },
  {
    name: TOOL_NAMES.DESCRIBE_TABLE,
    description: "Get detailed information about a specific table",
    inputSchema: {
      type: "object",
      properties: {
        schema: { type: "string" },
        table: { type: "string" },
      },
      required: ["schema", "table"],
    },
  },
  {
    name: TOOL_NAMES.FIND_COLUMN,
    description: "Find tables containing columns with specific name patterns",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string" },
      },
      required: ["pattern"],
    },
  },
  {
    name: TOOL_NAMES.ANALYZE_QUERY,
    description:
      "Analyze SQL query performance and provide optimization recommendations",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string" },
      },
      required: ["sql"],
    },
  },
  {
    name: TOOL_NAMES.GET_TABLE_LINEAGE,
    description: "Get data lineage and dependency information for a table",
    inputSchema: {
      type: "object",
      properties: {
        schema: { type: "string" },
        table: { type: "string" },
      },
      required: ["schema", "table"],
    },
  },
  {
    name: TOOL_NAMES.CHECK_PERMISSIONS,
    description: "Check user permissions for database operations",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["SELECT", "INSERT", "UPDATE", "DELETE"],
        },
        schema: { type: "string" },
        table: {
          type: "string",
          description: "Optional table name",
        },
      },
      required: ["operation", "schema"],
    },
  },
] as const;

/**
 * Main tool call handler - dispatches to specific tool handlers
 *
 * @param pool - Database connection pool
 * @param toolName - Name of the tool to execute
 * @param args - Tool arguments
 * @returns Promise resolving to tool response
 */
export async function handleToolCall(
  pool: Pool,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResponse> {
  const client = await pool.connect();

  try {
    switch (toolName as TOOL_NAMES) {
      case TOOL_NAMES.QUERY: {
        return await handleQueryTool(client, args as unknown as QueryToolArgs);
      }
      case TOOL_NAMES.DESCRIBE_TABLE: {
        return await handleDescribeTableTool(
          client,
          args as unknown as DescribeTableArgs,
        );
      }
      case TOOL_NAMES.FIND_COLUMN: {
        return await handleFindColumnTool(
          client,
          args as unknown as FindColumnArgs,
        );
      }
      case TOOL_NAMES.ANALYZE_QUERY: {
        return await handleAnalyzeQueryTool(
          client,
          args as unknown as AnalyzeQueryArgs,
        );
      }
      case TOOL_NAMES.GET_TABLE_LINEAGE: {
        return await handleTableLineageTool(
          client,
          args as unknown as GetTableLineageArgs,
        );
      }
      case TOOL_NAMES.CHECK_PERMISSIONS: {
        return await handlePermissionsTool(
          client,
          args as unknown as CheckPermissionsArgs,
        );
      }
      default: {
        return {
          content: [
            {
              type: TOOL_RESPONSE_TYPES.TEXT,
              text: `Unknown tool: ${toolName}`,
            },
          ],
          isError: true,
        };
      }
    }
  } finally {
    client.release();
  }
}

/**
 * Handle SQL query execution with security validation
 *
 * @param client - Database client connection
 * @param args - Query tool arguments
 * @returns Promise resolving to query results
 */
async function handleQueryTool(
  client: PoolClient,
  args: QueryToolArgs,
): Promise<ToolResponse> {
  const sql = args.sql;

  // Validate SQL query for security
  const validation = SecurityValidator.validateSqlQuery(sql);
  if (!validation.isValid) {
    return {
      content: [
        {
          type: TOOL_RESPONSE_TYPES.TEXT,
          text: `Security validation failed:\n${validation.errors.join("\n")}`,
        },
      ],
      isError: true,
    };
  }

  try {
    const startTime = Date.now();

    // Debug: Log that we're about to execute a Spectrum-aware query
    console.log(
      "🚀 [DEBUG] About to execute Spectrum-aware query:",
      `${sql.slice(0, 100)}...`,
    );

    // Use Spectrum-aware query execution
    const result = await DatabaseOperations.executeSpectrumQuery(client, sql);
    const duration = Date.now() - startTime;

    // Log query execution for audit
    console.log(`Query executed in ${duration}ms: ${sql.slice(0, 100)}...`);

    return {
      content: [
        {
          type: TOOL_RESPONSE_TYPES.TEXT,
          text: JSON.stringify(
            {
              rows: result,
              rowCount: result.length,
              executionTime: `${duration}ms`,
              message: "Query executed successfully with Spectrum support",
            },
            null,
            2,
          ),
        },
      ],
      isError: false,
    };
  } catch (error) {
    return {
      content: [
        {
          type: TOOL_RESPONSE_TYPES.TEXT,
          text: `Error executing query: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handle table description requests
 *
 * @param client - Database client connection
 * @param args - Describe table arguments
 * @returns Promise resolving to table description
 */
async function handleDescribeTableTool(
  client: PoolClient,
  args: DescribeTableArgs,
): Promise<ToolResponse> {
  const schema = SecurityValidator.sanitizeSchemaName(args.schema);
  const table = SecurityValidator.sanitizeTableName(args.table);

  try {
    // Get column information using DatabaseOperations
    const columns = await DatabaseOperations.getTableColumns(
      client,
      schema,
      table,
    );

    // Get table statistics using DatabaseOperations
    const statistics = await DatabaseOperations.getTableStatistics(
      client,
      schema,
      table,
    );

    const tableDescription = {
      schema,
      table,
      columns,
      statistics:
        statistics.length > 0
          ? statistics
          : [
              {
                total_size_mb: "Unknown",
                row_count: "Unknown",
                create_time: "Unknown",
              },
            ],
    };

    return {
      content: [
        {
          type: TOOL_RESPONSE_TYPES.TEXT,
          text: JSON.stringify(tableDescription, null, 2),
        },
      ],
      isError: false,
    };
  } catch (error) {
    return {
      content: [
        {
          type: TOOL_RESPONSE_TYPES.TEXT,
          text: `Error describing table: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handle column search requests
 *
 * @param client - Database client connection
 * @param args - Find column arguments
 * @returns Promise resolving to matching columns
 */
async function handleFindColumnTool(
  client: PoolClient,
  args: FindColumnArgs,
): Promise<ToolResponse> {
  const pattern = args.pattern;

  try {
    // Use DatabaseOperations to find columns
    const result = await DatabaseOperations.findColumnsByPattern(
      client,
      pattern,
    );

    return {
      content: [
        {
          type: TOOL_RESPONSE_TYPES.TEXT,
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError: false,
    };
  } catch (error) {
    return {
      content: [
        {
          type: TOOL_RESPONSE_TYPES.TEXT,
          text: `Error finding columns: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handle query analysis requests
 *
 * @param client - Database client connection
 * @param args - Analyze query arguments
 * @returns Promise resolving to query analysis
 */
async function handleAnalyzeQueryTool(
  client: PoolClient,
  args: AnalyzeQueryArgs,
): Promise<ToolResponse> {
  const sql = args.sql;

  // Validate SQL query for security
  const validation = SecurityValidator.validateSqlQuery(sql);
  if (!validation.isValid) {
    return {
      content: [
        {
          type: TOOL_RESPONSE_TYPES.TEXT,
          text: `Security validation failed:\n${validation.errors.join("\n")}`,
        },
      ],
      isError: true,
    };
  }

  try {
    // Get query execution plan using DatabaseOperations
    const explainResult = await DatabaseOperations.getQueryExecutionPlan(
      client,
      sql,
    );

    // Analyze query patterns and provide recommendations
    const recommendations = analyzeQueryPatterns(sql);
    const potentialIssues = identifyPerformanceIssues(sql);

    const analysis: QueryAnalysis = {
      query_text: sql,
      estimated_cost: 0, // Redshift doesn't provide cost estimates in EXPLAIN
      execution_plan: explainResult
        .map((row: DatabaseRow) => Object.values(row).join(" "))
        .join("\n"),
      recommendations,
      potential_issues: potentialIssues,
    };

    return {
      content: [
        {
          type: TOOL_RESPONSE_TYPES.TEXT,
          text: JSON.stringify(analysis, null, 2),
        },
      ],
      isError: false,
    };
  } catch (error) {
    return {
      content: [
        {
          type: TOOL_RESPONSE_TYPES.TEXT,
          text: `Error analyzing query: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handle table lineage requests
 *
 * @param client - Database client connection
 * @param args - Table lineage arguments
 * @returns Promise resolving to table lineage information
 */
async function handleTableLineageTool(
  client: PoolClient,
  args: GetTableLineageArgs,
): Promise<ToolResponse> {
  const schema = SecurityValidator.sanitizeSchemaName(args.schema);
  const table = SecurityValidator.sanitizeTableName(args.table);

  try {
    // Use DatabaseOperations to get table lineage
    const lineageData = await DatabaseOperations.getTableLineage(
      client,
      schema,
      table,
    );

    const lineage: TableLineage = {
      target_table: {
        schema,
        table,
      },
      dependencies: lineageData.dependencies.map((dep) => ({
        schema: dep.referenced_schema,
        table: dep.referenced_table,
        constraint_type: dep.relationship_type,
      })),
      referenced_by: lineageData.referencedBy.map((ref) => ({
        schema: ref.schema_name,
        table: ref.table_name,
        constraint_type: ref.relationship_type,
      })),
    };

    return {
      content: [
        {
          type: TOOL_RESPONSE_TYPES.TEXT,
          text: JSON.stringify(lineage, null, 2),
        },
      ],
      isError: false,
    };
  } catch (error) {
    return {
      content: [
        {
          type: TOOL_RESPONSE_TYPES.TEXT,
          text: `Error getting table lineage: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handle permissions check requests
 *
 * @param client - Database client connection
 * @param args - Check permissions arguments
 * @returns Promise resolving to permission information
 */
async function handlePermissionsTool(
  client: PoolClient,
  args: CheckPermissionsArgs,
): Promise<ToolResponse> {
  const operation = args.operation;
  const schema = SecurityValidator.sanitizeSchemaName(args.schema);
  const table = args.table;

  try {
    // Use DatabaseOperations to check permissions
    const result = await DatabaseOperations.checkPermissions(
      client,
      operation,
      schema,
      table ? SecurityValidator.sanitizeTableName(table) : undefined,
    );

    const permissions = {
      operation,
      schema,
      table: table || "ALL",
      current_user: "current_user", // Would need to get actual user
      permissions: result,
    };

    return {
      content: [
        {
          type: TOOL_RESPONSE_TYPES.TEXT,
          text: JSON.stringify(permissions, null, 2),
        },
      ],
      isError: false,
    };
  } catch (error) {
    return {
      content: [
        {
          type: TOOL_RESPONSE_TYPES.TEXT,
          text: `Error checking permissions: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Analyze SQL query patterns and provide recommendations
 *
 * @param sql - SQL query to analyze
 * @returns Array of recommendation strings
 */
function analyzeQueryPatterns(sql: string): string[] {
  const recommendations: string[] = [];
  const sqlLower = sql.toLowerCase();

  // Check for common performance issues
  if (sqlLower.includes("select *")) {
    recommendations.push(
      "Consider selecting only the columns you need instead of using SELECT *",
    );
  }

  if (sqlLower.includes("order by") && !sqlLower.includes("limit")) {
    recommendations.push(
      "Consider adding a LIMIT clause when using ORDER BY to avoid sorting large result sets",
    );
  }

  if (sqlLower.includes("like") && sqlLower.includes("%")) {
    const likePattern = sql.match(/like\s+['']%.*%['']/i);
    if (likePattern) {
      recommendations.push(
        "Leading wildcard in LIKE pattern may prevent index usage",
      );
    }
  }

  return recommendations;
}

/**
 * Identify potential performance issues in SQL query
 *
 * @param sql - SQL query to analyze
 * @returns Array of potential issue strings
 */
function identifyPerformanceIssues(sql: string): string[] {
  const potentialIssues: string[] = [];
  const sqlLower = sql.toLowerCase();

  if (
    !sqlLower.includes("where") &&
    sqlLower.includes("select") &&
    !sqlLower.includes("limit")
  ) {
    potentialIssues.push("Query without WHERE clause may scan entire table");
  }

  if (sqlLower.includes("like") && sqlLower.includes("%")) {
    const likePattern = sql.match(/like\s+['']%.*%['']/i);
    if (likePattern) {
      potentialIssues.push(
        "Leading wildcard in LIKE pattern may prevent index usage",
      );
    }
  }

  return potentialIssues;
}
