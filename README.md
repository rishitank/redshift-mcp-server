# Redshift MCP Server (TypeScript)

This is a Model Context Protocol (MCP) server for Amazon Redshift implemented in TypeScript. It follows Anthropic's implementation pattern and provides Cursor IDE and other MCP-compatible clients with rich contextual information about your Redshift data warehouse. This server enables LLMs to inspect database schemas and execute read-only queries.

This is an unofficial Redshift MCP server and can be used while waiting for Amazon to build their own: https://github.com/awslabs/mcp/issues/132.

## Integration with MCP Clients

### Project-Specific Configuration

Create a `.cursor/mcp.json` file in your project directory:

```json
{
  "mcpServers": {
    "redshift-mcp": {
      "command": "node",
      "args": ["path/to/dist/index.js"],
      "env": {
        "DATABASE_URL": "redshift://username:password@hostname:port/database?ssl=true"
      }
    }
  }
}
```

### Global Configuration

For using across all projects, create `~/.cursor/mcp.json` in your home directory with the same configuration.

### Client-Specific Setup

#### Augment Code

Run the following command to build the Docker image

```
docker build -t redshift-mcp .
```

In Augment Code, Add a new MCP mentioning Redshift in the name and add the following replacing the variables accordingly:

```
docker run -e DATABASE_URL="redshift://USERNAME:PASSWORD@HOSTNAME:5439/DBNAME" -i --rm redshift-mcp
```

#### Cursor IDE

1. The server will be automatically detected if configured in `mcp.json`
2. Tools will appear under "Available Tools" in MCP settings
3. Agent will automatically use the tools when relevant

#### Other MCP Clients

Configure the server using stdio transport:

```json
{
  "servers": [
    {
      "name": "redshift-mcp",
      "transport": {
        "kind": "stdio",
        "command": ["node", "path/to/dist/index.js"]
      }
    }
  ]
}
```

## Prerequisites

- Node.js 16 or higher
- TypeScript
- Access to an Amazon Redshift cluster
- Basic knowledge of Redshift and SQL
- Cursor IDE installed

## Installation

1. Clone this repository or copy the files to your local system
2. Install the dependencies:

```bash
npm install
```

3. Build the TypeScript code:

```bash
npm run build
```

## Usage

The server requires a Redshift connection URL via the `DATABASE_URL` environment variable:

```bash
export DATABASE_URL="redshift://username:password@hostname:port/database?ssl=true"
npm start
```

Or you can run directly:

```bash
DATABASE_URL="redshift://username:password@hostname:port/database?ssl=true" node dist/index.js
```

For development, you can use:

```bash
DATABASE_URL="redshift://username:password@hostname:port/database?ssl=true" npm run dev
```

### Connection URL Format

```plaintext
redshift://username:password@hostname:port/database?ssl=true
```

- **username**: Your Redshift username
- **password**: Your Redshift password
- **hostname**: Your Redshift cluster endpoint
- **port**: Usually 5439 for Redshift
- **database**: The name of your database
- **ssl**: Set to "true" for secure connection (recommended)

Additional connection parameters:

- `ssl=true`: Required for secure connections (recommended)
- `timeout=10`: Connection timeout in seconds
- `keepalives=1`: Enable TCP keepalive
- `keepalives_idle=130`: TCP keepalive idle time

### Redshift Spectrum Configuration

The server supports Redshift Spectrum external tables with intelligent transaction management:

#### Environment Variables

- `REDSHIFT_SPECTRUM_ENABLED`: Enable/disable Spectrum external table support (default: `true`)
  - Set to `false` to disable all Spectrum functionality
- `REDSHIFT_SPECTRUM_DEBUG`: Enable detailed logging for Spectrum detection (default: `false`)
  - Set to `true` to see detailed logs about external table detection and transaction choices
- `REDSHIFT_SPECTRUM_STRICT_VALIDATION`: Enable strict query validation (default: `true`)
  - Validates all queries are SELECT-only statements to prevent data modifications
  - Set to `false` to disable validation (not recommended for security)

#### How It Works

The server automatically detects when queries involve external tables and uses intelligent transaction management:

- **External table queries**: Uses read-write transactions (required for Glue metadata) with strict SELECT-only validation
- **Regular table queries**: Uses read-only transactions for maximum security
- **Comprehensive validation**: All queries validated to ensure they are SELECT statements only
- **Nested query protection**: Validates subqueries and CTEs to prevent hidden modification statements

#### Examples

````bash
# Enable Spectrum with debug logging
export REDSHIFT_SPECTRUM_ENABLED=true
export REDSHIFT_SPECTRUM_DEBUG=true

# Enable strict validation (default, recommended)
export REDSHIFT_SPECTRUM_STRICT_VALIDATION=true

# Disable Spectrum entirely
export REDSHIFT_SPECTRUM_ENABLED=false

## Pluggable Logging Configuration

The server supports multiple logging backends that can be used simultaneously for integration with existing monitoring solutions.

### Supported Logging Backends

- **MCP**: Real-time notifications to MCP clients (always enabled)
- **Console**: Development logging with colors and formatting
- **HTTP**: Generic HTTP webhooks for custom integrations
- **Datadog**: Enterprise monitoring and alerting
- **New Relic**: Application performance monitoring
- **Splunk**: Enterprise log management and analytics
- **Elasticsearch**: Search and analytics platform
- **Sentry**: Error tracking and performance monitoring with distributed tracing

### Environment Variables

#### General Logging
```bash
export REDSHIFT_LOGGING_ENABLED=true
export REDSHIFT_LOG_LEVEL=info
export REDSHIFT_LOGGING_CONFIG_FILE=/path/to/logging-config.json
````

#### Console Logging

```bash
export REDSHIFT_CONSOLE_LOGGING=true
export REDSHIFT_CONSOLE_COLORIZE=true
export REDSHIFT_CONSOLE_FORMAT=pretty
export REDSHIFT_CONSOLE_LOG_LEVEL=debug
```

#### HTTP Webhook Logging

```bash
export REDSHIFT_HTTP_LOG_URL=https://your-webhook.com/logs
export REDSHIFT_HTTP_LOG_API_KEY=your-api-key
export REDSHIFT_HTTP_LOG_METHOD=POST
export REDSHIFT_HTTP_LOG_BATCH_SIZE=10
export REDSHIFT_HTTP_LOG_FLUSH_INTERVAL=5000
```

#### Datadog Integration

```bash
export REDSHIFT_DATADOG_API_KEY=your-datadog-api-key
export REDSHIFT_DATADOG_SITE=datadoghq.com
export REDSHIFT_DATADOG_SERVICE=redshift-mcp-server
export REDSHIFT_DATADOG_TAGS=env:production,team:data
```

#### New Relic Integration

```bash
export REDSHIFT_NEWRELIC_LICENSE_KEY=your-license-key
export REDSHIFT_NEWRELIC_ENDPOINT=https://log-api.newrelic.com/log/v1
```

#### Splunk Integration

```bash
export REDSHIFT_SPLUNK_URL=https://your-splunk.com:8088/services/collector
export REDSHIFT_SPLUNK_TOKEN=your-hec-token
export REDSHIFT_SPLUNK_INDEX=redshift-logs
```

#### Elasticsearch Integration

```bash
export REDSHIFT_ELASTICSEARCH_URL=https://your-elasticsearch.com:9200
export REDSHIFT_ELASTICSEARCH_INDEX=redshift-mcp-server
export REDSHIFT_ELASTICSEARCH_USERNAME=elastic
export REDSHIFT_ELASTICSEARCH_PASSWORD=your-password
```

#### Sentry Integration (Error Tracking & Performance)

```bash
export REDSHIFT_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
export REDSHIFT_SENTRY_ENVIRONMENT=production
export REDSHIFT_SENTRY_RELEASE=1.0.0
export REDSHIFT_SENTRY_SAMPLE_RATE=1.0
export REDSHIFT_SENTRY_TRACES_SAMPLE_RATE=0.1
export REDSHIFT_SENTRY_PERFORMANCE=true
export REDSHIFT_SENTRY_PROFILING=true
export REDSHIFT_SENTRY_TAGS=team:data,service:redshift
```

```

## Project Structure

```

src/
├── index.ts # Main server orchestration
├── constants.ts # Centralized constants and configuration
├── types.ts # TypeScript type definitions
├── database/
│ └── operations.ts # Database query operations
├── handlers/
│ ├── resource-handler.ts # MCP resource handlers
│ └── tool-handler.ts # MCP tool handlers
├── security/
│ └── validator.ts # Security validation and sanitization
└── logging/
└── mcp-logger.ts # MCP logging infrastructure

dist/ # Compiled JavaScript output
├── index.js # Bundled server (31.8kb)
└── index.js.map # Source maps for debugging

config/
├── tsconfig.json # TypeScript configuration
├── tsconfig.build.json # Build-specific TypeScript config
├── esbuild.config.ts # Build system configuration
├── eslint.config.js # ESLint configuration
└── jest.config.ts # Test configuration

docker/
├── Dockerfile # Production Docker image
├── Dockerfile.test # Test environment Docker image
└── docker-compose.test.yml # Test orchestration

````

## Architecture

### Modular Design
- **Clean Separation**: Business logic separated from MCP protocol handling
- **Single Responsibility**: Each module has a focused, well-defined purpose
- **Type Safety**: Comprehensive TypeScript typing throughout
- **Reusable Components**: Database operations and handlers are modular and reusable

### Security Architecture
- **Defense in Depth**: Multiple layers of security validation and sanitization
- **Principle of Least Privilege**: Read-only by default, write access only when required
- **Audit Trail**: Comprehensive logging of all operations for security monitoring

### Performance Architecture
- **Intelligent Caching**: Efficient resource discovery and caching
- **Connection Pooling**: PostgreSQL connection pooling for optimal performance
- **Bundle Optimization**: Tree-shaken, optimized 31.8kb bundle with esbuild

## Components

### Tools Available

- **query**
  - Execute SQL queries with intelligent Spectrum support
  - Automatically detects external tables and uses appropriate transaction types
  - Includes security validation and performance monitoring
  - Example: "Write a query to show all tables in the public schema"

- **describe_table**
  - Get comprehensive table information including columns, data types, and statistics
  - Shows distribution keys, sort keys, and Redshift-specific metadata
  - Example: "Show me the structure of the users table"

- **find_column**
  - Search for columns across all tables using pattern matching
  - Supports case-insensitive pattern searches
  - Example: "Find all tables that have a column containing 'email'"

- **analyze_query**
  - Analyze SQL query performance and provide optimization recommendations
  - Generates execution plans and identifies potential performance issues
  - Provides Redshift-specific optimization suggestions
  - Example: "Analyze this query for performance bottlenecks"

- **get_table_lineage**
  - Discover data lineage and dependency relationships between tables
  - Shows foreign key relationships and table dependencies
  - Helps understand data flow and impact analysis
  - Example: "Show me what tables depend on the customers table"

- **check_permissions**
  - Check user permissions for database operations
  - Validates access rights for SELECT, INSERT, UPDATE, DELETE operations
  - Supports schema-level and table-level permission checks
  - Example: "Check if I have SELECT permissions on the sales schema"

### Resources Available

The server provides comprehensive database information through structured resources:

- **Schema Listings** (`redshift://<host>/schema/<schema_name>`)
  - Lists all tables within a specific schema
  - Includes both regular Redshift tables and Spectrum external tables
  - Automatically discovered from database metadata

- **Table Schemas** (`redshift://<host>/<schema>/<table>/schema`)
  - Complete JSON schema information for each table
  - Includes column names, data types, nullability, and default values
  - Shows Redshift-specific attributes (distribution keys, sort keys)
  - Supports both regular and external tables

- **Sample Data** (`redshift://<host>/<schema>/<table>/sample`)
  - Sample rows from each table (limited to 5 for performance)
  - Automatic PII redaction for sensitive fields (email, phone, SSN, credit card)
  - Works with both regular and Spectrum external tables

- **Statistics** (`redshift://<host>/<schema>/<table>/statistics`)
  - Comprehensive table statistics including size, row count, and creation time
  - Distribution style and compression information
  - Table encoding and sort key details
  - Performance metrics for optimization insights

### Prompts Available

The server provides AI prompt templates for common database tasks:

- **analyze-query-performance**
  - Generates structured prompts for SQL query optimization analysis
  - Includes Redshift-specific optimization guidance
  - Covers distribution keys, sort keys, and columnar storage benefits

- **explore-schema**
  - Creates prompts for database schema exploration and understanding
  - Helps understand table relationships and data flow patterns
  - Provides best practices for working with specific schemas

- **troubleshoot-redshift**
  - Generates prompts for Redshift performance issue diagnosis
  - Includes systematic troubleshooting approaches
  - Covers preventive measures and monitoring strategies

## Security Considerations

This server implements comprehensive security measures:

### Transaction Security
- **Intelligent Transaction Management**: Uses read-only transactions by default for maximum security
- **Controlled Spectrum Access**: Uses read-write transactions only for external tables with strict validation
- **SELECT-Only Validation**: All queries validated to ensure they are SELECT statements only
- **Nested Query Protection**: Validates subqueries and CTEs to prevent hidden modification statements
- **Multi-layer Validation**: Multiple security checks before any transaction execution

### Input Validation & Sanitization
- **SQL Injection Prevention**: Comprehensive input sanitization and validation
- **Schema/Table Name Sanitization**: Prevents malicious schema or table name injection
- **Query Pattern Analysis**: Validates query patterns before execution

### Data Protection
- **Automatic PII Redaction**: Redacts sensitive data (email, phone, SSN, credit card) in sample results
- **Connection Security**: Does not expose raw password information in resource URIs
- **Secure Logging**: Structured logging without exposing sensitive connection details

### Access Control
- **Permission Checking**: Built-in tools to verify user permissions before operations
- **Audit Logging**: Comprehensive logging of all database operations for security auditing
- **Environment Isolation**: Should be used in a secure environment with proper network controls

### Advanced Security Features
- **Real-time Monitoring**: MCP logging provides real-time visibility into all operations
- **Security Event Logging**: Dedicated security event logging for compliance and monitoring
- **Fallback Security**: Conservative defaults when external table detection is uncertain

## Example Interactions

Here are some example questions you can ask AI clients once connected:

### Basic Database Exploration
1. "Show me all tables in the public schema"
2. "What's the structure of the customers table?"
3. "Find all tables that contain customer information"
4. "Show me sample data from the products table"

### Advanced Analysis
5. "Analyze this query for performance bottlenecks: SELECT * FROM large_table WHERE date > '2024-01-01'"
6. "What tables depend on the customers table?"
7. "Check my permissions for the sales schema"
8. "Show me the lineage for the orders table"

### Spectrum External Tables
9. "Query data from the external table: SELECT * FROM spectrum_schema.external_table LIMIT 10"
10. "Show me all external schemas available"
11. "What's the structure of the external table in the data lake?"

### Performance Optimization
12. "Generate a prompt to optimize this slow query"
13. "Help me troubleshoot performance issues in the analytics schema"
14. "Analyze the distribution and sort keys for the sales table"

## Advanced Features

### Redshift Spectrum Support
- **Automatic Detection**: Intelligently detects queries involving external tables
- **Smart Transaction Management**: Uses read-write transactions only when needed for Spectrum
- **Security First**: Defaults to read-only transactions for regular queries
- **Configurable Behavior**: Environment variables control Spectrum functionality

### Real-time Monitoring & Pluggable Logging
- **MCP Logging**: Structured log messages sent to clients in real-time
- **Pluggable Backends**: Support for multiple logging destinations simultaneously
- **Enterprise Integration**: Built-in support for Datadog, New Relic, Splunk, Elasticsearch
- **Custom Backends**: HTTP webhooks for integration with any monitoring solution
- **Performance Tracking**: Query execution time monitoring and reporting
- **Security Auditing**: Comprehensive logging of all security-related events
- **Correlation Tracking**: Request correlation IDs for distributed tracing

### AI Integration
- **Prompt Templates**: Pre-built prompts for common database analysis tasks
- **Context-Aware Suggestions**: AI prompts that leverage available MCP tools
- **Optimization Guidance**: Redshift-specific optimization recommendations

## Development

### Development Commands

```bash
# Development with hot reload
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Run tests
npm test

# Run all tests including integration
npm run test:all
````

### Code Quality

The project maintains high code quality standards:

- **ESLint**: Comprehensive linting with 6+ plugins (Jest, Node.js, Import, Security, Promise, Unicorn)
- **TypeScript**: Strict type checking with comprehensive type coverage
- **Code Formatting**: Consistent formatting with single quotes, semicolons, no trailing commas
- **Security Scanning**: Built-in security linting and validation
- **Import Organization**: Automatic import formatting and organization

### Testing

- **Unit Tests**: Comprehensive unit test coverage
- **Integration Tests**: Database integration testing with test containers
- **Type Testing**: TypeScript compilation testing
- **Linting Tests**: Code quality and formatting validation

### Build System

- **esbuild**: Ultra-fast bundling with tree shaking
- **TypeScript**: Full TypeScript compilation pipeline
- **Source Maps**: Debug support with source map generation
- **Bundle Optimization**: Optimized 31.8kb production bundle
- **Docker Support**: Multi-stage Docker builds for production deployment

## License

MIT
