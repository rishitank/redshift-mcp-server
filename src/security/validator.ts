/**
 * Security Validation Module for Redshift MCP Server
 *
 * This module provides comprehensive security validation utilities for SQL queries
 * and database identifiers to prevent SQL injection attacks and ensure safe
 * database operations.
 */

import { ValidationResult } from "../types";
import { logger } from "../logging/global-logger";

/**
 * SecurityValidator class provides static methods for validating and sanitizing
 * SQL queries and database identifiers to prevent security vulnerabilities.
 */
export const SecurityValidator = {
  /**
   * Validates an SQL query for potential security threats and dangerous operations.
   *
   * This method performs comprehensive security checks including:
   * - Detection of dangerous SQL operations (DROP, DELETE, UPDATE, etc.)
   * - SQL injection pattern detection
   * - Tautology-based injection detection
   * - Comment-based injection detection
   * - Union-based injection detection
   *
   * @param sql - The SQL query string to validate
   * @returns ValidationResult object containing validation status and any errors
   */
  validateSqlQuery(sql: string): ValidationResult {
    const errors: string[] = [];

    // Input validation
    if (!sql || typeof sql !== "string") {
      errors.push("SQL query must be a non-empty string");
      return {
        isValid: false,
        errors,
      };
    }

    const normalizedSql = sql.toLowerCase().trim();

    // Check for empty or whitespace-only queries
    if (normalizedSql.length === 0) {
      errors.push("SQL query cannot be empty");
      return {
        isValid: false,
        errors,
      };
    }

    // Check for dangerous operations that could modify data or structure
    const dangerousPatterns = [
      /\b(drop|delete|update|insert|alter|create|truncate)\b/i,
      /\b(grant|revoke)\b/i,
      /\b(exec|execute)\b/i,
      /\b(xp_|sp_)\w+/i, // SQL Server extended procedures
      /\b(union\s+select)\b/i, // Basic SQL injection pattern
      /;\s*--/i, // Comment injection
      /;\s*\/\*/i, // Comment block injection
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(normalizedSql)) {
        errors.push(
          `Potentially dangerous SQL pattern detected: ${pattern.source}`,
        );
        logger.warning(
          "Security validation failed: Dangerous pattern detected in SQL query",
          {
            component: "security",
            event: "dangerous-pattern-detected",
            pattern: pattern.source,
          },
        );
      }
    }

    // Enhanced SQL injection detection patterns
    const injectionPatterns = [
      // Tautology-based injection (1=1, 'a'='a', etc.)
      /\b(or|and)\s+[''][^'']*['']\s*=\s*[''][^'']*['']?/i,
      // Suspicious OR patterns (but not normal AND conditions)
      /\bor\s+['']?\w*['']?\s*=\s*['']?\w*['']?/i,
      // Union-based injection
      /union\s+(all\s+)?select/i,
      // Comment-based injection
      /--\s*$/i,
      /\/\*.*?\*\//i,
      // Tautology-based injection with numbers
      /\b(or|and)\s+\d+\s*=\s*\d+/i,
      // String-based injection with quotes
      /'\s*(or|and)\s*'/i,
      // Hexadecimal injection patterns
      /0x[0-9a-f]+/i,
      // Multiple statement injection
      /;\s*(select|insert|update|delete|drop|create|alter)/i,
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(normalizedSql)) {
        errors.push("Potential SQL injection pattern detected");
        logger.warning(
          "Security validation failed: SQL injection pattern detected in query",
          {
            component: "security",
            event: "sql-injection-detected",
            pattern: pattern.source,
          },
        );
        break; // Only add one injection error to avoid spam
      }
    }

    // Additional security checks
    if (normalizedSql.includes("@@")) {
      errors.push("Global variables access detected");
    }

    if (
      normalizedSql.includes("information_schema") &&
      !normalizedSql.includes("select")
    ) {
      errors.push("Suspicious information_schema access detected");
    }

    // Log successful validation for audit purposes
    if (errors.length === 0) {
      console.log(`SQL query validation passed: ${sql.slice(0, 50)}...`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  /**
   * Sanitizes a table name by removing potentially dangerous characters.
   *
   * Only allows alphanumeric characters, underscores, and dots (for schema.table notation).
   * This prevents SQL injection through table name manipulation.
   *
   * @param name - The table name to sanitize
   * @returns Sanitized table name with only safe characters
   */
  sanitizeTableName(name: string): string {
    if (!name || typeof name !== "string") {
      console.warn("Invalid table name provided for sanitization");
      return "";
    }

    // Only allow alphanumeric characters, underscores, and dots
    const sanitized = name.replaceAll(/[^a-zA-Z0-9_.]/g, "");

    if (sanitized !== name) {
      console.warn(`Table name sanitized: "${name}" -> "${sanitized}"`);
    }

    return sanitized;
  },

  /**
   * Sanitizes a schema name by removing potentially dangerous characters.
   *
   * Only allows alphanumeric characters and underscores.
   * This prevents SQL injection through schema name manipulation.
   *
   * @param name - The schema name to sanitize
   * @returns Sanitized schema name with only safe characters
   */
  sanitizeSchemaName(name: string): string {
    if (!name || typeof name !== "string") {
      console.warn("Invalid schema name provided for sanitization");
      return "";
    }

    // Only allow alphanumeric characters and underscores
    const sanitized = name.replaceAll(/[^a-zA-Z0-9_]/g, "");

    if (sanitized !== name) {
      console.warn(`Schema name sanitized: "${name}" -> "${sanitized}"`);
    }

    return sanitized;
  },

  /**
   * Validates that a database identifier (schema, table, column name) is safe to use.
   *
   * @param identifier - The database identifier to validate
   * @param type - The type of identifier ('schema', 'table', 'column')
   * @returns ValidationResult object containing validation status and any errors
   */
  validateIdentifier(
    identifier: string,
    type: "schema" | "table" | "column",
  ): ValidationResult {
    const errors: string[] = [];

    if (!identifier || typeof identifier !== "string") {
      errors.push(`${type} identifier must be a non-empty string`);
      return {
        isValid: false,
        errors,
      };
    }

    // Check length limits
    if (identifier.length > 63) {
      errors.push(`${type} identifier exceeds maximum length of 63 characters`);
    }

    // Check for reserved keywords
    const reservedKeywords = [
      "select",
      "from",
      "where",
      "insert",
      "update",
      "delete",
      "drop",
      "create",
      "alter",
      "table",
      "database",
      "schema",
      "index",
      "view",
      "procedure",
      "function",
      "trigger",
      "user",
      "role",
      "grant",
      "revoke",
    ];

    if (reservedKeywords.includes(identifier.toLowerCase())) {
      errors.push(
        `${type} identifier cannot be a reserved keyword: ${identifier}`,
      );
    }

    // Check for valid characters based on type
    let validPattern: RegExp;
    switch (type) {
      case "schema": {
        validPattern = /^[a-zA-Z0-9_]+$/;
        break;
      }
      case "table": {
        validPattern = /^[a-zA-Z0-9_.]+$/;
        break;
      }
      case "column": {
        validPattern = /^[a-zA-Z0-9_]+$/;
        break;
      }
    }

    if (!validPattern.test(identifier)) {
      errors.push(
        `${type} identifier contains invalid characters: ${identifier}`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },
};
