/**
 * Constants for Redshift MCP Server
 *
 * This module contains shared constants used throughout the application
 * to avoid duplication and ensure consistency.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Get package.json data for single source of truth
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.join(__dirname, "../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
  name: string;
  version: string;
};

/**
 * Package name from package.json
 */
export const PACKAGE_NAME = packageJson.name;

/**
 * Application version from package.json
 */
export const APP_VERSION = packageJson.version;

/**
 * MIME types used in MCP responses
 */
export const MIME_TYPES = {
  JSON: "application/json",
} as const;

/**
 * Resource path constants for MCP resource URIs
 */
export const RESOURCE_PATHS = {
  SCHEMA: "schema",
  SAMPLE: "sample",
  STATISTICS: "statistics",
  QUERY_HISTORY: "query-history",
  PERMISSIONS: "permissions",
  DEPENDENCIES: "dependencies",
} as const;

/**
 * Tool response types for MCP tool calls
 */
export const TOOL_RESPONSE_TYPES = {
  TEXT: "text",
} as const;

/**
 * Tool names enum for MCP tools
 * Provides type safety and eliminates magic strings for tool names
 */
export enum TOOL_NAMES {
  QUERY = "query",
  DESCRIBE_TABLE = "describe_table",
  FIND_COLUMN = "find_column",
  ANALYZE_QUERY = "analyze_query",
  GET_TABLE_LINEAGE = "get_table_lineage",
  CHECK_PERMISSIONS = "check_permissions",
}

/**
 * Prompt names enum for MCP prompts
 * Provides type safety and eliminates magic strings for prompt names
 */
export enum PROMPT_NAMES {
  ANALYZE_QUERY_PERFORMANCE = "analyze-query-performance",
  EXPLORE_SCHEMA = "explore-schema",
  TROUBLESHOOT_REDSHIFT = "troubleshoot-redshift",
}

/**
 * Spectrum configuration options
 */
export const SPECTRUM_CONFIG = {
  // Enable/disable Spectrum support entirely
  ENABLED: process.env.REDSHIFT_SPECTRUM_ENABLED !== "false",

  // Enable detailed logging for Spectrum detection
  DEBUG_LOGGING: process.env.REDSHIFT_SPECTRUM_DEBUG === "true",

  // Use strict validation mode (default: true) - validates all queries are SELECT-only
  STRICT_VALIDATION:
    process.env.REDSHIFT_SPECTRUM_STRICT_VALIDATION !== "false",
} as const;
