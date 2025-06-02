# Redshift MCP Server (TypeScript)

This is a Model Context Protocol (MCP) server for Amazon Redshift implemented in TypeScript. It follows Anthropic's implementation pattern and provides Cursor IDE and other MCP-compatible clients with rich contextual information about your Redshift data warehouse. This server enables LLMs to inspect database schemas and execute read-only queries.

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

## Project Structure

- `src/index.ts`: Main TypeScript implementation
- `dist/`: Compiled JavaScript output
- `package.json`: Project dependencies and scripts
- `tsconfig.json`: TypeScript configuration

## Components

### Tools Available in Cursor

- **query**
  - Execute read-only SQL queries against the connected Redshift database
  - Example: "Write a query to show all tables in the public schema"

- **describe_table**
  - Get detailed information about a specific table
  - Example: "Show me the structure of the users table"

- **find_column**
  - Find tables containing columns with specific name patterns
  - Example: "Find all tables that have a column containing 'email'"

### Resources Available to Cursor

The server provides schema information that Cursor can use:

- **Schema Listings** (`redshift://<host>/schema/<schema_name>`)
  - Lists all tables within a specific schema
  - Automatically discovered from database metadata

- **Table Schemas** (`redshift://<host>/<schema>/<table>/schema`)
  - JSON schema information for each table
  - Includes column names, data types, and Redshift-specific attributes (distribution and sort keys)

- **Sample Data** (`redshift://<host>/<schema>/<table>/sample`)
  - Sample rows from each table (limited to 5)
  - Sensitive data is automatically redacted

- **Statistics** (`redshift://<host>/<schema>/<table>/statistics`)
  - Table statistics including size, row count, and creation time
  - Distribution and compression information

## Security Considerations

This server:

- Uses read-only transactions for queries to prevent modifications
- Sanitizes inputs to prevent SQL injection
- Does not expose raw password information in resource URIs
- Automatically redacts sensitive data in sample results (email, phone)
- Should be used in a secure environment since it has access to your database

## Example Cursor Interactions

Here are some example questions you can ask Cursor once connected:

1. "Show me all tables in the public schema"
2. "What's the structure of the customers table?"
3. "Find all tables that contain customer information"
4. "Write a query to count orders by status"
5. "Show me sample data from the products table"

## Extending the Server

You can extend this server by:

1. Adding new resource types in the `ListResourcesRequestSchema` and `ReadResourceRequestSchema` handlers
2. Adding new tools in the `ListToolsRequestSchema` and `CallToolRequestSchema` handlers
3. Enhancing security features or adding authentication

## Development

For development, you can use the `npm run dev` command, which uses ts-node to run the TypeScript code directly without pre-compilation.

## License

MIT
