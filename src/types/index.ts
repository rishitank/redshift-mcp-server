/**
 * Type definitions for Redshift MCP Server
 *
 * This module contains all TypeScript interface definitions used throughout
 * the Redshift MCP (Model Context Protocol) server implementation.
 */

/**
 * Represents a Redshift database schema
 */
export interface RedshiftSchema {
  /** The name of the schema */
  schema_name: string;
}

/**
 * Represents a table within a Redshift schema
 */
export interface RedshiftTable {
  /** The name of the table */
  table_name: string;
}

/**
 * Represents a column definition in a Redshift table
 */
export interface RedshiftColumn {
  /** The name of the column */
  column_name: string;
  /** The data type of the column */
  data_type: string;
  /** Maximum character length for string types */
  character_maximum_length?: number | null;
  /** Numeric precision for numeric types */
  numeric_precision?: number | null;
  /** Numeric scale for decimal types */
  numeric_scale?: number | null;
  /** Whether the column allows NULL values */
  is_nullable: string;
  /** Default value for the column */
  column_default?: string | null;
  /** Position of the column in the table */
  ordinal_position: number;
  /** Whether this column is a distribution key */
  is_distkey: boolean;
  /** Whether this column is a sort key */
  is_sortkey: boolean;
}

/**
 * Represents table statistics and metadata from Redshift
 */
export interface RedshiftStatistics {
  /** Database name */
  database: string;
  /** Schema name */
  schema: string;
  /** Unique table identifier */
  table_id: number;
  /** Table name */
  table_name: string;
  /** Total size in megabytes */
  total_size_mb: number;
  /** Percentage of disk space used */
  percent_used: number;
  /** Number of rows in the table */
  row_count: number;
  /** Whether the table uses encoding */
  encoded: boolean;
  /** Distribution style (EVEN, KEY, ALL) */
  diststyle: string;
  /** Primary sort key column */
  sortkey1: string;
  /** Maximum varchar length in the table */
  max_varchar: number;
  /** Table creation timestamp */
  create_time: string;
}

/**
 * Represents a query execution record from Redshift query history
 */
export interface QueryHistory {
  /** Unique query identifier */
  query_id: number;
  /** Username who executed the query */
  user_name: string;
  /** Database name where query was executed */
  database: string;
  /** The SQL query text */
  query_text: string;
  /** Query start timestamp */
  start_time: string;
  /** Query end timestamp */
  end_time: string;
  /** Query execution duration in milliseconds */
  duration_ms: number;
  /** Query execution status */
  status: string;
  /** Number of rows returned by the query */
  rows_returned: number;
}

/**
 * Represents user permissions for database objects
 */
export interface UserPermission {
  /** Schema name */
  schema_name: string;
  /** Table name */
  table_name: string;
  /** Type of privilege (SELECT, INSERT, UPDATE, DELETE) */
  privilege_type: string;
  /** Whether the permission can be granted to others */
  is_grantable: boolean;
  /** User who granted the permission */
  grantor: string;
}

/**
 * Represents table dependencies and foreign key relationships
 */
export interface TableDependency {
  /** Schema containing the dependent table */
  schema_name: string;
  /** Name of the dependent table */
  table_name: string;
  /** Schema containing the referenced table */
  referenced_schema: string;
  /** Name of the referenced table */
  referenced_table: string;
  /** Name of the constraint */
  constraint_name: string;
  /** Type of constraint (FOREIGN KEY, PRIMARY KEY, etc.) */
  constraint_type: string;
}

/**
 * Represents the result of query analysis and optimization recommendations
 */
export interface QueryAnalysis {
  /** The analyzed SQL query text */
  query_text: string;
  /** Estimated execution cost */
  estimated_cost: number;
  /** Query execution plan */
  execution_plan: string;
  /** Performance optimization recommendations */
  recommendations: string[];
  /** Potential performance issues identified */
  potential_issues: string[];
}

/**
 * Represents table lineage showing dependencies and relationships
 */
export interface TableLineage {
  /** The target table being analyzed */
  target_table: {
    /** Schema name */
    schema: string;
    /** Table name */
    table: string;
  };
  /** Tables that this table depends on */
  dependencies: Array<{
    /** Schema name */
    schema: string;
    /** Table name */
    table: string;
    /** Type of constraint relationship */
    constraint_type: string;
  }>;
  /** Tables that depend on this table */
  referenced_by: Array<{
    /** Schema name */
    schema: string;
    /** Table name */
    table: string;
    /** Type of constraint relationship */
    constraint_type: string;
  }>;
}

/**
 * Represents permission check results for database operations
 */
export interface PermissionCheck {
  /** The operation being checked */
  operation: string;
  /** Schema name */
  schema: string;
  /** Optional table name */
  table?: string;
  /** List of permissions for the operation */
  permissions: Array<{
    /** Type of privilege */
    privilege_type: string;
    /** Whether the permission can be granted */
    is_grantable: boolean;
  }>;
}

/**
 * Generic type for database row data
 */
export interface DatabaseRow {
  /** Dynamic properties with unknown values */
  [key: string]: unknown;
}

/**
 * Generic type for query results with proper typing
 */
export interface QueryResult<T = DatabaseRow> {
  /** Array of result rows */
  rows: T[];
  /** Number of rows affected/returned */
  rowCount: number | null;
  /** Field metadata */
  fields?: Array<{
    /** Field name */
    name: string;
    /** PostgreSQL data type ID */
    dataTypeID: number;
  }>;
}

// Tool argument interfaces for MCP tool calls

/**
 * Arguments for the query tool
 */
export interface QueryToolArgs {
  /** SQL query to execute */
  sql: string;
}

/**
 * Arguments for the describe_table tool
 */
export interface DescribeTableArgs {
  /** Schema name */
  schema: string;
  /** Table name */
  table: string;
}

/**
 * Arguments for the find_column tool
 */
export interface FindColumnArgs {
  /** Column name pattern to search for */
  pattern: string;
}

/**
 * Arguments for the analyze_query tool
 */
export interface AnalyzeQueryArgs {
  /** SQL query to analyze */
  sql: string;
}

/**
 * Arguments for the get_table_lineage tool
 */
export interface GetTableLineageArgs {
  /** Schema name */
  schema: string;
  /** Table name */
  table: string;
}

/**
 * Arguments for the check_permissions tool
 */
export interface CheckPermissionsArgs {
  /** Database operation type */
  operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE";
  /** Schema name */
  schema: string;
  /** Optional table name */
  table?: string;
}

/**
 * Validation result from security checks
 */
export interface ValidationResult {
  /** Whether the validation passed */
  isValid: boolean;
  /** List of validation errors */
  errors: string[];
}
