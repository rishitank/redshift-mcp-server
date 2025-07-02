/**
 * Database Operations Module for Redshift MCP Server
 *
 * This module provides reusable database query functions for Redshift operations.
 * All functions are designed to be secure, efficient, and properly typed.
 */

import { PoolClient } from "pg";
import sql, { raw } from "sql-template-tag";
import { SPECTRUM_CONFIG } from "../constants";
import { logger } from "../logging/global-logger";
import {
  RedshiftSchema,
  RedshiftTable,
  RedshiftColumn,
  RedshiftStatistics,
  QueryHistory,
  UserPermission,
  TableDependency,
  DatabaseRow,
} from "../types";
import { DatabaseLoggingManager } from "../logging/interfaces";

// Global logging manager instance (will be set from main module)
let globalLoggingManager: DatabaseLoggingManager | null = null;

export function setGlobalLoggingManager(manager: DatabaseLoggingManager): void {
  globalLoggingManager = manager;
}

/**
 * Database operations class providing static methods for common Redshift queries
 */
export const DatabaseOperations = {
  /**
   * Get all user schemas (excluding system schemas)
   *
   * @param client - Database client connection
   * @returns Promise resolving to array of schema objects
   */
  async getSchemas(client: PoolClient): Promise<RedshiftSchema[]> {
    try {
      const result = await client.query<RedshiftSchema>(sql`
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
        UNION
        SELECT DISTINCT
          schemaname as schema_name
        FROM
          svv_external_schemas
        WHERE
          schemaname NOT LIKE 'pg_%'
          AND schemaname NOT IN ('information_schema', 'sys')
        ORDER BY
          schema_name
      `);

      console.log(
        `Retrieved ${result.rows.length} schemas (including Spectrum external schemas)`,
      );
      return result.rows;
    } catch (error) {
      console.error("Error retrieving schemas:", error);
      throw new Error(
        `Failed to retrieve schemas: ${(error as Error).message}`,
      );
    }
  },

  /**
   * Get all tables in a specific schema
   *
   * @param client - Database client connection
   * @param schemaName - Name of the schema
   * @returns Promise resolving to array of table objects
   */
  async getTables(
    client: PoolClient,
    schemaName: string,
  ): Promise<RedshiftTable[]> {
    try {
      const result = await client.query<RedshiftTable>(sql`
        SELECT
          table_name
        FROM
          SVV_TABLES
        WHERE
          table_schema = ${schemaName}
        UNION
        SELECT
          tablename as table_name
        FROM
          svv_external_tables
        WHERE
          schemaname = ${schemaName}
        ORDER BY
          table_name
      `);

      console.log(
        `Retrieved ${result.rows.length} tables from schema ${schemaName} (including Spectrum external tables)`,
      );
      return result.rows;
    } catch (error) {
      console.error(`Error retrieving tables for schema ${schemaName}:`, error);
      throw new Error(`Failed to retrieve tables: ${(error as Error).message}`);
    }
  },

  /**
   * Get detailed column information for a specific table
   *
   * @param client - Database client connection
   * @param schemaName - Name of the schema
   * @param tableName - Name of the table
   * @returns Promise resolving to array of column objects
   */
  async getTableColumns(
    client: PoolClient,
    schemaName: string,
    tableName: string,
  ): Promise<RedshiftColumn[]> {
    try {
      const result = await client.query<RedshiftColumn>(sql`
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

      console.log(
        `Retrieved ${result.rows.length} columns for table ${schemaName}.${tableName}`,
      );
      return result.rows;
    } catch (error) {
      console.error(
        `Error retrieving columns for table ${schemaName}.${tableName}:`,
        error,
      );
      throw new Error(
        `Failed to retrieve table columns: ${(error as Error).message}`,
      );
    }
  },

  /**
   * Get table statistics and metadata
   *
   * @param client - Database client connection
   * @param schemaName - Name of the schema
   * @param tableName - Name of the table
   * @returns Promise resolving to table statistics
   */
  async getTableStatistics(
    client: PoolClient,
    schemaName: string,
    tableName: string,
  ): Promise<RedshiftStatistics[]> {
    try {
      const result = await client.query<RedshiftStatistics>(sql`
        SELECT
          database,
          schema,
          table_id,
          'table' as table_name,
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

      console.log(`Retrieved statistics for table ${schemaName}.${tableName}`);
      return result.rows;
    } catch (error) {
      console.error(
        `Error retrieving statistics for table ${schemaName}.${tableName}:`,
        error,
      );
      throw new Error(
        `Failed to retrieve table statistics: ${(error as Error).message}`,
      );
    }
  },

  /**
   * Get table dependencies and constraints
   *
   * @param client - Database client connection
   * @param schemaName - Name of the schema
   * @param tableName - Name of the table
   * @returns Promise resolving to array of dependency objects
   */
  async getTableDependencies(
    client: PoolClient,
    schemaName: string,
    tableName: string,
  ): Promise<TableDependency[]> {
    try {
      const result = await client.query<TableDependency>(sql`
        SELECT DISTINCT
          n1.nspname as schema_name,
          c1.relname as table_name,
          n2.nspname as referenced_schema,
          c2.relname as referenced_table,
          con.conname as constraint_name,
          CASE con.contype
            WHEN 'f' THEN 'FOREIGN KEY'
            WHEN 'p' THEN 'PRIMARY KEY'
            WHEN 'u' THEN 'UNIQUE'
            WHEN 'c' THEN 'CHECK'
            ELSE 'OTHER'
          END as constraint_type
        FROM
          pg_constraint con
          JOIN pg_class c1 ON con.conrelid = c1.oid
          JOIN pg_namespace n1 ON c1.relnamespace = n1.oid
          LEFT JOIN pg_class c2 ON con.confrelid = c2.oid
          LEFT JOIN pg_namespace n2 ON c2.relnamespace = n2.oid
        WHERE
          n1.nspname = ${schemaName}
          AND c1.relname = ${tableName}
          AND con.contype IN ('f', 'p', 'u')
        ORDER BY
          constraint_type,
          constraint_name
      `);

      console.log(
        `Retrieved ${result.rows.length} dependencies for table ${schemaName}.${tableName}`,
      );
      return result.rows;
    } catch (error) {
      console.error(
        `Error retrieving dependencies for table ${schemaName}.${tableName}:`,
        error,
      );
      throw new Error(
        `Failed to retrieve table dependencies: ${(error as Error).message}`,
      );
    }
  },

  /**
   * Get recent query history from Redshift
   *
   * @param client - Database client connection
   * @param limitDays - Number of days to look back (default: 7)
   * @param limitRows - Maximum number of rows to return (default: 100)
   * @returns Promise resolving to array of query history objects
   */
  async getQueryHistory(
    client: PoolClient,
    limitDays: number = 7,
    limitRows: number = 100,
  ): Promise<QueryHistory[]> {
    try {
      const result = await client.query<QueryHistory>(sql`
        SELECT
          query as query_id,
          userid as user_name,
          database,
          querytxt as query_text,
          starttime as start_time,
          endtime as end_time,
          EXTRACT(
            EPOCH
            FROM
              (endtime - starttime)
          ) * 1000 as duration_ms,
          CASE
            WHEN aborted = 1 THEN 'ABORTED'
            WHEN suspended = 1 THEN 'SUSPENDED'
            ELSE 'COMPLETED'
          END as status,
          0 as rows_returned
        FROM
          STL_QUERY
        WHERE
          starttime >= CURRENT_DATE - INTERVAL ${raw(`'${limitDays} days'`)}
          AND userid > 1
        ORDER BY
          starttime DESC
        LIMIT
          ${limitRows}
      `);

      console.log(`Retrieved ${result.rows.length} query history records`);
      return result.rows;
    } catch (error) {
      console.error("Error retrieving query history:", error);
      throw new Error(
        `Failed to retrieve query history: ${(error as Error).message}`,
      );
    }
  },

  /**
   * Get user permissions for database objects
   *
   * @param client - Database client connection
   * @returns Promise resolving to array of permission objects
   */
  async getUserPermissions(client: PoolClient): Promise<UserPermission[]> {
    try {
      const result = await client.query<UserPermission>(sql`
        SELECT DISTINCT
          schemaname as schema_name,
          tablename as table_name,
          'SELECT' as privilege_type,
          false as is_grantable,
          tableowner as grantor
        FROM
          pg_tables
        WHERE
          schemaname NOT LIKE 'pg_%'
          AND schemaname NOT IN ('information_schema', 'sys')
        ORDER BY
          schema_name,
          table_name
      `);

      console.log(`Retrieved ${result.rows.length} permission records`);
      return result.rows;
    } catch (error) {
      console.error("Error retrieving user permissions:", error);
      throw new Error(
        `Failed to retrieve user permissions: ${(error as Error).message}`,
      );
    }
  },

  /**
   * Get sample data from a table with PII redaction
   *
   * @param client - Database client connection
   * @param schemaName - Name of the schema
   * @param tableName - Name of the table
   * @param limit - Number of rows to return (default: 5)
   * @returns Promise resolving to array of sample data rows
   */
  async getSampleData(
    client: PoolClient,
    schemaName: string,
    tableName: string,
    limit: number = 5,
  ): Promise<DatabaseRow[]> {
    try {
      const result = await client.query<DatabaseRow>(sql`
        SELECT
          *
        FROM
          ${raw(`"${schemaName}"."${tableName}"`)}
        LIMIT
          ${limit}
      `);

      // Redact PII data for security
      const redactedRows = result.rows.map((row: DatabaseRow): DatabaseRow => {
        const newRow = { ...row };
        if ("email" in newRow && typeof newRow.email === "string") {
          newRow.email = "REDACTED";
        }
        if ("phone" in newRow && typeof newRow.phone === "string") {
          newRow.phone = "REDACTED";
        }
        if ("ssn" in newRow && typeof newRow.ssn === "string") {
          newRow.ssn = "REDACTED";
        }
        if ("credit_card" in newRow && typeof newRow.credit_card === "string") {
          newRow.credit_card = "REDACTED";
        }
        return newRow;
      });

      console.log(
        `Retrieved ${redactedRows.length} sample rows from ${schemaName}.${tableName}`,
      );
      return redactedRows;
    } catch (error) {
      console.error(
        `Error retrieving sample data from ${schemaName}.${tableName}:`,
        error,
      );
      throw new Error(
        `Failed to retrieve sample data: ${(error as Error).message}`,
      );
    }
  },

  /**
   * Find columns matching a pattern across all tables
   *
   * @param client - Database client connection
   * @param pattern - Column name pattern to search for
   * @returns Promise resolving to array of matching columns
   */
  async findColumnsByPattern(
    client: PoolClient,
    pattern: string,
  ): Promise<
    Array<
      Pick<RedshiftColumn, "column_name" | "data_type"> & {
        table_schema: string;
        table_name: string;
      }
    >
  > {
    try {
      const result = await client.query<
        Pick<RedshiftColumn, "column_name" | "data_type"> & {
          table_schema: string;
          table_name: string;
        }
      >(sql`
        SELECT
          table_schema,
          table_name,
          column_name,
          data_type
        FROM
          SVV_COLUMNS
        WHERE
          column_name ILIKE ${`%${pattern}%`}
        ORDER BY
          table_schema,
          table_name,
          column_name
      `);

      console.log(
        `Found ${result.rows.length} columns matching pattern: ${pattern}`,
      );
      return result.rows;
    } catch (error) {
      console.error(`Error finding columns with pattern ${pattern}:`, error);
      throw new Error(`Failed to find columns: ${(error as Error).message}`);
    }
  },

  /**
   * Get table lineage relationships (foreign key dependencies)
   *
   * @param client - Database client connection
   * @param schemaName - Name of the schema
   * @param tableName - Name of the table
   * @returns Promise resolving to lineage information
   */
  async getTableLineage(
    client: PoolClient,
    schemaName: string,
    tableName: string,
  ): Promise<{
    dependencies: Array<{
      schema_name: string;
      table_name: string;
      referenced_schema: string;
      referenced_table: string;
      constraint_name: string;
      relationship_type: string;
    }>;
    referencedBy: Array<{
      schema_name: string;
      table_name: string;
      relationship_type: string;
    }>;
  }> {
    try {
      // Get foreign key relationships
      const dependenciesResult = await client.query<{
        schema_name: string;
        table_name: string;
        referenced_schema: string;
        referenced_table: string;
        constraint_name: string;
        relationship_type: string;
      }>(sql`
        SELECT DISTINCT
          n1.nspname as schema_name,
          c1.relname as table_name,
          n2.nspname as referenced_schema,
          c2.relname as referenced_table,
          con.conname as constraint_name,
          'REFERENCES' as relationship_type
        FROM
          pg_constraint con
          JOIN pg_class c1 ON con.conrelid = c1.oid
          JOIN pg_namespace n1 ON c1.relnamespace = n1.oid
          JOIN pg_class c2 ON con.confrelid = c2.oid
          JOIN pg_namespace n2 ON c2.relnamespace = n2.oid
        WHERE
          (
            n1.nspname = ${schemaName}
            AND c1.relname = ${tableName}
          )
          OR (
            n2.nspname = ${schemaName}
            AND c2.relname = ${tableName}
          )
          AND con.contype = 'f'
        ORDER BY
          relationship_type,
          schema_name,
          table_name
      `);

      // Get tables that reference this table
      const referencingResult = await client.query<{
        schema_name: string;
        table_name: string;
        relationship_type: string;
      }>(sql`
        SELECT DISTINCT
          n1.nspname as schema_name,
          c1.relname as table_name,
          'REFERENCED_BY' as relationship_type
        FROM
          pg_constraint con
          JOIN pg_class c1 ON con.conrelid = c1.oid
          JOIN pg_namespace n1 ON c1.relnamespace = n1.oid
          JOIN pg_class c2 ON con.confrelid = c2.oid
          JOIN pg_namespace n2 ON c2.relnamespace = n2.oid
        WHERE
          n2.nspname = ${schemaName}
          AND c2.relname = ${tableName}
          AND con.contype = 'f'
      `);

      console.log(
        `Retrieved lineage for table ${schemaName}.${tableName}: ${dependenciesResult.rows.length} dependencies, ${referencingResult.rows.length} references`,
      );

      return {
        dependencies: dependenciesResult.rows,
        referencedBy: referencingResult.rows,
      };
    } catch (error) {
      console.error(
        `Error retrieving lineage for table ${schemaName}.${tableName}:`,
        error,
      );
      throw new Error(
        `Failed to retrieve table lineage: ${(error as Error).message}`,
      );
    }
  },

  /**
   * Check user permissions for specific operations on database objects
   *
   * @param client - Database client connection
   * @param operation - Type of operation to check
   * @param schemaName - Name of the schema
   * @param tableName - Optional table name
   * @returns Promise resolving to permission information
   */
  async checkPermissions(
    client: PoolClient,
    operation: string,
    schemaName: string,
    tableName?: string,
  ): Promise<
    {
      schema_name: string;
      table_name: string;
      owner: string;
      has_permission: boolean;
    }[]
  > {
    try {
      const result = await client.query<{
        schema_name: string;
        table_name: string;
        owner: string;
        has_permission: boolean;
      }>(
        tableName
          ? sql`
        SELECT
          schemaname as schema_name,
          tablename as table_name,
          tableowner as owner,
          CASE
            WHEN tableowner = current_user THEN true
            ELSE false
          END as has_permission
        FROM
          pg_tables
        WHERE
          schemaname = ${schemaName}
          AND tablename = ${tableName}
      `
          : sql`
        SELECT
          schemaname as schema_name,
          tablename as table_name,
          tableowner as owner,
          CASE
            WHEN tableowner = current_user THEN true
            ELSE false
          END as has_permission
        FROM
          pg_tables
        WHERE
          schemaname = ${schemaName}
      `,
      );

      console.log(
        `Checked ${operation} permissions for ${schemaName}${tableName ? `.${tableName}` : ""}: ${result.rows.length} objects`,
      );
      return result.rows;
    } catch (error) {
      console.error(
        `Error checking permissions for ${operation} on ${schemaName}${tableName ? `.${tableName}` : ""}:`,
        error,
      );
      throw new Error(
        `Failed to check permissions: ${(error as Error).message}`,
      );
    }
  },

  /**
   * Execute a query and get execution plan for analysis
   *
   * @param client - Database client connection
   * @param sqlQuery - SQL query to analyze
   * @returns Promise resolving to execution plan
   */
  async getQueryExecutionPlan(
    client: PoolClient,
    sqlQuery: string,
  ): Promise<DatabaseRow[]> {
    try {
      const result = await client.query<DatabaseRow>(
        sql`EXPLAIN ${raw(sqlQuery)}`,
      );

      console.log(
        `Retrieved execution plan for query: ${sqlQuery.slice(0, 50)}...`,
      );
      return result.rows;
    } catch (error) {
      console.error(
        `Error getting execution plan for query: ${sqlQuery.slice(0, 50)}...`,
        error,
      );
      throw new Error(
        `Failed to get execution plan: ${(error as Error).message}`,
      );
    }
  },

  /**
   * Execute a query with secure Spectrum external table support
   * Uses read-only transactions with specific Spectrum metadata permissions
   *
   * @param client - Database client connection
   * @param sqlQuery - SQL query to execute
   * @returns Promise resolving to query results
   */
  async executeSpectrumQuery(
    client: PoolClient,
    sqlQuery: string,
  ): Promise<DatabaseRow[]> {
    console.log(
      "🔥 [DEBUG] executeSpectrumQuery called with query:",
      `${sqlQuery.slice(0, 100)}...`,
    );
    console.log("🔥 [DEBUG] SPECTRUM_CONFIG:", SPECTRUM_CONFIG);

    const startTime = Date.now();
    let transactionId: string | undefined;

    try {
      // Start performance monitoring transaction
      if (globalLoggingManager) {
        transactionId = globalLoggingManager.startTransaction(
          "database.query",
          "db.query",
          `query-${Date.now()}`,
        );
      }

      // First, validate that the query is actually a SELECT statement
      const isSelectQuery = this.validateSelectOnlyQuery(sqlQuery);
      if (!isSelectQuery) {
        if (globalLoggingManager && transactionId) {
          globalLoggingManager.finishTransaction(
            transactionId,
            "invalid_query",
          );
        }
        throw new Error("Only SELECT queries are allowed for security");
      }

      // Check configuration flags
      if (!SPECTRUM_CONFIG.ENABLED) {
        logger.debug(
          "Spectrum support disabled - using read-only transaction",
          {
            component: "database",
            event: "spectrum-disabled",
          },
        );

        // Spectrum disabled, use read-only
        await client.query("BEGIN TRANSACTION READ ONLY");
        try {
          const result = await client.query<DatabaseRow>(raw(sqlQuery));
          await client.query("COMMIT");
          return result.rows;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }

      // Check if query involves external tables
      logger.debug("About to check for external tables in query", {
        component: "database",
        event: "external-table-check",
        queryPreview: sqlQuery.slice(0, 100),
      });
      const isExternalTableQuery = await this.isExternalTableQuery(
        client,
        sqlQuery,
      );
      logger.debug("External table detection result", {
        component: "database",
        event: "external-table-detection",
        isExternalTableQuery,
      });

      if (isExternalTableQuery) {
        if (SPECTRUM_CONFIG.DEBUG_LOGGING) {
          console.log(
            "🌟 Detected external table query - using secure Spectrum transaction",
          );
        }

        // Use a secure Spectrum transaction that allows metadata operations but prevents data modifications
        try {
          return await this.executeSecureSpectrumQuery(client, sqlQuery);
        } catch (error) {
          if (SPECTRUM_CONFIG.DEBUG_LOGGING) {
            console.log(
              "⚠️ Secure Spectrum query failed, attempting traditional fallback:",
              (error as Error).message,
            );
          }

          // === FALLBACK INTEGRATION ===
          // If secure approach fails, try traditional approach as fallback
          return await this.executeTraditionalSpectrumQuery(client, sqlQuery);
        }
      } else {
        if (SPECTRUM_CONFIG.DEBUG_LOGGING) {
          console.log(
            "🔒 Regular query detected - using read-only transaction for security",
          );
        }

        // Regular query, use read-only for security
        await client.query("BEGIN TRANSACTION READ ONLY");
        try {
          const result = await client.query<DatabaseRow>(raw(sqlQuery));
          await client.query("COMMIT");

          // Log successful execution with performance metrics
          if (globalLoggingManager) {
            const duration = Date.now() - startTime;
            await globalLoggingManager.info(
              "Database query executed successfully",
              {
                component: "database",
                event: "query_executed",
                duration,
                queryType: "regular",
                rowCount: result.rows.length,
                queryId: transactionId,
              },
            );

            if (transactionId) {
              globalLoggingManager.finishTransaction(transactionId, "ok");
            }
          }

          return result.rows;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }
    } catch (error) {
      // Log error with performance metrics
      if (globalLoggingManager) {
        const duration = Date.now() - startTime;
        await globalLoggingManager.error(
          "Database query failed",
          error as Error,
          {
            component: "database",
            event: "query_failed",
            duration,
            queryId: transactionId,
            sql: sqlQuery.slice(0, 200),
          },
        );

        if (transactionId) {
          globalLoggingManager.finishTransaction(
            transactionId,
            "internal_error",
          );
        }
      }

      console.error(
        `Error executing query: ${sqlQuery.slice(0, 50)}...`,
        error,
      );
      throw new Error(`Failed to execute query: ${(error as Error).message}`);
    }
  },

  /**
   * Execute a Spectrum query with controlled permissions
   * Uses read-write transaction but with additional query validation for security
   *
   * @param client - Database client connection
   * @param sqlQuery - SQL query to execute (must be SELECT only)
   * @returns Promise resolving to query results
   */
  async executeSecureSpectrumQuery(
    client: PoolClient,
    sqlQuery: string,
  ): Promise<DatabaseRow[]> {
    try {
      // Double-check that this is a SELECT-only query before proceeding
      if (!this.validateSelectOnlyQuery(sqlQuery)) {
        throw new Error("Only SELECT queries are allowed for security");
      }

      // Additional validation: ensure no nested modification statements
      if (this.containsNestedModifications(sqlQuery)) {
        throw new Error(
          "Query contains nested modification statements which are not allowed",
        );
      }

      // Begin a read-write transaction (required for Spectrum metadata incorporation)
      // but with strict validation to ensure only SELECT operations
      await client.query("BEGIN");

      logger.debug(
        "Using controlled read-write transaction for Spectrum with SELECT-only validation",
        {
          component: "database",
          event: "spectrum-transaction-start",
        },
      );

      try {
        const result = await client.query<DatabaseRow>(raw(sqlQuery));
        await client.query("COMMIT");

        if (SPECTRUM_CONFIG.DEBUG_LOGGING) {
          console.log(
            `✅ Successfully executed validated Spectrum query: ${sqlQuery.slice(0, 50)}...`,
          );
        }
        return result.rows;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    } catch (error) {
      console.error(`Error in secure Spectrum execution: ${error}`);
      throw error;
    }
  },

  /**
   * Fallback method for Spectrum queries using traditional read-write transaction
   * Only used when the secure approach fails
   *
   * @param client - Database client connection
   * @param sqlQuery - SQL query to execute
   * @returns Promise resolving to query results
   */
  async executeTraditionalSpectrumQuery(
    client: PoolClient,
    sqlQuery: string,
  ): Promise<DatabaseRow[]> {
    const startTime = Date.now();
    let transactionId: string | undefined;

    try {
      // Log fallback usage for monitoring
      if (globalLoggingManager) {
        transactionId = globalLoggingManager.startTransaction(
          "spectrum_fallback",
          "database_query",
        );
        await globalLoggingManager.warning(
          "Using traditional Spectrum fallback method",
          {
            component: "database",
            event: "spectrum_fallback_used",
            queryId: transactionId,
            sql: sqlQuery.slice(0, 200),
          },
        );
      }

      // Traditional approach: read-write transaction for metadata incorporation
      await client.query("BEGIN");

      const result = await client.query<DatabaseRow>(raw(sqlQuery));
      await client.query("COMMIT");

      // Log successful fallback execution
      if (globalLoggingManager) {
        const duration = Date.now() - startTime;
        await globalLoggingManager.info(
          "Traditional Spectrum fallback succeeded",
          {
            component: "database",
            event: "spectrum_fallback_success",
            duration,
            queryId: transactionId,
            rowCount: result.rows.length,
          },
        );

        if (transactionId) {
          globalLoggingManager.finishTransaction(transactionId, "ok");
        }
      }

      if (SPECTRUM_CONFIG.DEBUG_LOGGING) {
        console.log(
          `✅ Successfully executed traditional Spectrum query: ${sqlQuery.slice(0, 50)}...`,
        );
      }
      return result.rows;
    } catch (error) {
      await client.query("ROLLBACK");

      // Log fallback failure
      if (globalLoggingManager) {
        const duration = Date.now() - startTime;
        await globalLoggingManager.error(
          "Traditional Spectrum fallback failed",
          error as Error,
          {
            component: "database",
            event: "spectrum_fallback_failed",
            duration,
            queryId: transactionId,
            sql: sqlQuery.slice(0, 200),
          },
        );

        if (transactionId) {
          globalLoggingManager.finishTransaction(
            transactionId,
            "internal_error",
          );
        }
      }

      throw error;
    }
  },

  /**
   * Validate that a query is SELECT-only for security
   *
   * @param sqlQuery - SQL query to validate
   * @returns boolean indicating if query is SELECT-only
   */
  validateSelectOnlyQuery(sqlQuery: string): boolean {
    const trimmedQuery = sqlQuery.trim().toLowerCase();

    // Must start with SELECT (allowing for comments and whitespace)
    const selectPattern = /^\s*(\/\*.*?\*\/)?\s*select\s/i;
    if (!selectPattern.test(trimmedQuery)) {
      return false;
    }

    // Check for prohibited statements that could modify data
    const prohibitedPatterns = [
      /\b(insert|update|delete|drop|create|alter|truncate|merge)\s/i,
      /\b(grant|revoke|set\s+session|set\s+role)\s/i,
      /\b(call|exec|execute)\s/i,
    ];

    for (const pattern of prohibitedPatterns) {
      if (pattern.test(trimmedQuery)) {
        return false;
      }
    }

    return true;
  },

  /**
   * Check for nested modification statements within subqueries or CTEs
   *
   * @param sqlQuery - SQL query to validate
   * @returns boolean indicating if query contains nested modifications
   */
  containsNestedModifications(sqlQuery: string): boolean {
    const lowerQuery = sqlQuery.toLowerCase();

    // Look for modification statements in subqueries or CTEs
    const nestedModificationPatterns = [
      /\(\s*(insert|update|delete|drop|create|alter|truncate|merge)\s/i,
      /with\s+\w+\s+as\s*\(\s*(insert|update|delete|drop|create|alter|truncate|merge)\s/i,
    ];

    for (const pattern of nestedModificationPatterns) {
      if (pattern.test(lowerQuery)) {
        return true;
      }
    }

    return false;
  },

  /**
   * Check if a query involves external tables (Spectrum) with enhanced detection
   *
   * @param client - Database client connection
   * @param sqlQuery - SQL query to analyze
   * @returns Promise resolving to boolean indicating if query uses external tables
   */
  async isExternalTableQuery(
    client: PoolClient,
    sqlQuery: string,
  ): Promise<boolean> {
    try {
      // Enhanced regex patterns to catch more table reference formats
      const patterns = [
        // Standard FROM/JOIN patterns
        /(?:FROM|JOIN)\s+(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi,
        // Subquery patterns
        /(?:FROM|JOIN)\s*\(\s*SELECT.*?FROM\s+(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi,
        // WITH clause patterns
        /WITH\s+\w+\s+AS\s*\(\s*SELECT.*?FROM\s+(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi,
      ];

      const tableReferences = new Set<string>();

      // Extract all table references using multiple patterns
      for (const pattern of patterns) {
        const matches = [...sqlQuery.matchAll(pattern)];
        for (const match of matches) {
          const schemaName = match[1] || "public";
          const tableName = match[2];
          if (
            tableName &&
            !/^(select|from|where|group|order|having|limit)$/i.test(tableName)
          ) {
            tableReferences.add(`${schemaName}.${tableName}`);
          }
        }
      }

      if (SPECTRUM_CONFIG.DEBUG_LOGGING) {
        console.log(
          `🔍 Checking ${tableReferences.size} table references for external tables:`,
          [...tableReferences],
        );
      }

      // Check each unique table reference
      for (const tableRef of tableReferences) {
        const [schemaName, tableName] = tableRef.split(".");

        // Check if this table is an external table
        const result = await client.query<{ count: number }>(sql`
          SELECT
            COUNT(*) as count
          FROM
            svv_external_tables
          WHERE
            schemaname = ${schemaName}
            AND tablename = ${tableName}
        `);

        if (result.rows[0]?.count > 0) {
          logger.debug("Found external table - using read-write transaction", {
            component: "database",
            event: "external-table-found",
            schemaName,
            tableName,
          });
          return true;
        } else {
          logger.debug("Table is not an external table", {
            component: "database",
            event: "external-table-not-found",
            schemaName,
            tableName,
          });
        }
      }

      logger.debug(
        "No external tables found - using read-only transaction for security",
        {
          component: "database",
          event: "no-external-tables",
        },
      );
      return false;
    } catch (error) {
      logger.error(
        "Error checking for external tables",
        error instanceof Error ? error : undefined,
        {
          component: "database",
          event: "external-table-check-error",
        },
      );
      // Conservative approach: if we can't determine, use read-only for security
      logger.debug(
        "Detection failed - defaulting to read-only transaction for security",
        {
          component: "database",
          event: "external-table-detection-fallback",
        },
      );
      return false;
    }
  },
};
