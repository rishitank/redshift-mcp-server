# Redshift MCP Server Extensions

This document describes the extensions implemented for the Redshift MCP Server, following the guidance in the README's "Extending the Server" section.

## Overview

The server has been extended with new resource types, tools, and enhanced security features to provide comprehensive Redshift database management capabilities through the Model Context Protocol.

## New Resource Types

### 1. Query History (`/query-history`)

- **Description**: Provides access to recent query execution history
- **Data Source**: STL_QUERY system table
- **Features**:
  - Last 7 days of query history
  - Query execution times and status
  - User information and database context
  - Limited to 100 most recent queries

### 2. User Permissions (`/permissions`)

- **Description**: Shows user access permissions for schemas and tables
- **Data Source**: pg_tables system view
- **Features**:
  - Schema and table ownership information
  - Permission types and grantors
  - Filtered to exclude system schemas

### 3. Table Dependencies (`/dependencies`)

- **Description**: Shows foreign key relationships and table dependencies
- **Data Source**: pg_constraint, pg_class, pg_namespace system tables
- **Features**:
  - Foreign key constraints
  - Primary key and unique constraints
  - Referenced table relationships

## New Tools

### 1. analyze_query

- **Purpose**: Analyze SQL query performance and provide optimization recommendations
- **Input**: SQL query string
- **Features**:
  - Security validation before analysis
  - Query execution plan via EXPLAIN
  - Performance recommendations
  - Potential issue identification
  - Pattern-based optimization suggestions

### 2. get_table_lineage

- **Purpose**: Get data lineage and dependency information for a specific table
- **Input**: Schema and table name
- **Features**:
  - Foreign key relationships
  - Tables that reference the target table
  - Bidirectional dependency mapping
  - Constraint information

### 3. check_permissions

- **Purpose**: Check user permissions for database operations
- **Input**: Operation type, schema, optional table name
- **Features**:
  - Permission validation for SELECT, INSERT, UPDATE, DELETE
  - Schema-level and table-level checks
  - Current user context
  - Ownership information

## Enhanced Security Features

### SecurityValidator Class

A new utility class that provides:

#### SQL Injection Prevention

- Pattern detection for dangerous SQL operations
- Comment injection protection
- Union-based injection detection
- Extended procedure blocking

#### Input Sanitization

- Schema name sanitization (alphanumeric + underscore)
- Table name sanitization (alphanumeric + underscore + dots)
- Parameter validation

#### Query Validation

- Pre-execution security checks
- Dangerous operation detection
- Injection pattern recognition

## Enhanced Query Tool

The original `query` tool has been enhanced with:

### Security Improvements

- Pre-execution SQL validation
- Enhanced error handling
- Audit logging

### Performance Monitoring

- Execution time tracking
- Result metadata
- Field information
- Row count reporting

### Response Enhancement

- Structured JSON responses
- Execution metrics
- Field type information
- Enhanced error messages

## Implementation Details

### Resource Handler Extensions

The `ReadResourceRequestSchema` handler now supports:

- Global resource routing for query history and permissions
- Enhanced path parsing with filtering
- New SQL queries for dependency analysis
- Improved error handling

### Tool Handler Extensions

The `CallToolRequestSchema` handler includes:

- Security validation pipeline
- Enhanced query analysis
- Lineage computation
- Permission checking logic

### Database Queries

New optimized queries for:

- STL_QUERY analysis for query history
- pg_constraint joins for dependency mapping
- pg_tables analysis for permissions
- EXPLAIN plan generation for query analysis

## Usage Examples

### Query History

```bash
# Access via resource
GET redshift://host/query-history
```

### Table Dependencies

```bash
# Access via resource
GET redshift://host/public/users/dependencies
```

### Query Analysis

```json
{
  "tool": "analyze_query",
  "arguments": {
    "sql": "SELECT * FROM public.users WHERE email LIKE '%@example.com'"
  }
}
```

### Table Lineage

```json
{
  "tool": "get_table_lineage",
  "arguments": {
    "schema": "public",
    "table": "orders"
  }
}
```

### Permission Check

```json
{
  "tool": "check_permissions",
  "arguments": {
    "operation": "SELECT",
    "schema": "public",
    "table": "sensitive_data"
  }
}
```

## Security Considerations

### Enhanced Protection

- SQL injection prevention through pattern matching
- Input sanitization for all user inputs
- Read-only transaction enforcement
- Audit logging for all operations

### Validation Pipeline

1. Input sanitization
2. SQL pattern validation
3. Security rule enforcement
4. Safe execution with rollback

### Audit Trail

- Query execution logging
- Performance metrics tracking
- Error condition recording
- User operation tracking

## Future Extensions

The architecture supports easy addition of:

- More resource types in the resource handlers
- Additional tools in the tool handlers
- Enhanced security rules in SecurityValidator
- Custom query analysis patterns
- Extended permission models

## Compatibility

All extensions maintain backward compatibility with:

- Existing MCP clients
- Original tool interfaces
- Current resource URIs
- Docker deployment methods

The extensions follow the MCP specification and integrate seamlessly with Cursor IDE, Augment Code, and other MCP-compatible clients.
