/**
 * Resource Handler Module for Redshift MCP Server
 *
 * This module provides MCP resource request handlers for listing and reading
 * database resources including schemas, tables, and various data views.
 */

import { Pool, PoolClient } from "pg";
import { MIME_TYPES, RESOURCE_PATHS } from "../constants";
import { DatabaseOperations } from "../database";
import {
  RedshiftSchema,
  RedshiftColumn,
  RedshiftStatistics,
  QueryHistory,
  UserPermission,
  TableDependency,
  DatabaseRow,
} from "../types";

/**
 * Handle MCP ListResources request - returns all available database resources
 *
 * @param pool - Database connection pool
 * @param resourceBaseUrl - Base URL for constructing resource URIs
 * @returns Promise resolving to MCP resources response
 */
export async function handleListResources(
  pool: Pool,
  resourceBaseUrl: URL,
): Promise<{
  resources: Array<{ uri: string; mimeType: string; name: string }>;
}> {
  const client = await pool.connect();

  try {
    const resources = await buildResourceList(client, resourceBaseUrl);

    console.log(`Listed ${resources.length} total resources`);
    return { resources };
  } finally {
    client.release();
  }
}

/**
 * Build complete list of available resources
 *
 * @param client - Database client connection
 * @param resourceBaseUrl - Base URL for constructing resource URIs
 * @returns Promise resolving to array of resource objects
 */
async function buildResourceList(
  client: PoolClient,
  resourceBaseUrl: URL,
): Promise<Array<{ uri: string; mimeType: string; name: string }>> {
  const resources: Array<{ uri: string; mimeType: string; name: string }> = [];

  // Get all schemas
  const schemas = await DatabaseOperations.getSchemas(client);

  // Add schema resources and their tables
  for (const schema of schemas) {
    await addSchemaResources(client, schema, resourceBaseUrl, resources);
  }

  // Add global resources
  addGlobalResources(resourceBaseUrl, resources);

  return resources;
}

/**
 * Add schema and table resources to the resource list
 *
 * @param client - Database client connection
 * @param schema - Schema object
 * @param resourceBaseUrl - Base URL for constructing resource URIs
 * @param resources - Array to add resources to
 */
async function addSchemaResources(
  client: PoolClient,
  schema: RedshiftSchema,
  resourceBaseUrl: URL,
  resources: Array<{ uri: string; mimeType: string; name: string }>,
): Promise<void> {
  // Add schema resource
  resources.push({
    uri: new URL(
      `${RESOURCE_PATHS.SCHEMA}/${schema.schema_name}`,
      resourceBaseUrl,
    ).href,
    mimeType: MIME_TYPES.JSON,
    name: `Schema: ${schema.schema_name}`,
  });

  // Get tables for this schema and add table resources
  const tables = await DatabaseOperations.getTables(client, schema.schema_name);

  for (const table of tables) {
    addTableResources(
      schema.schema_name,
      table.table_name,
      resourceBaseUrl,
      resources,
    );
  }
}

/**
 * Add table-specific resources to the resource list
 *
 * @param schemaName - Name of the schema
 * @param tableName - Name of the table
 * @param resourceBaseUrl - Base URL for constructing resource URIs
 * @param resources - Array to add resources to
 */
function addTableResources(
  schemaName: string,
  tableName: string,
  resourceBaseUrl: URL,
  resources: Array<{ uri: string; mimeType: string; name: string }>,
): void {
  const tablePrefix = `${schemaName}/${tableName}`;

  // Add all table resources at once
  resources.push(
    {
      uri: new URL(`${tablePrefix}/${RESOURCE_PATHS.SCHEMA}`, resourceBaseUrl)
        .href,
      mimeType: MIME_TYPES.JSON,
      name: `Table Schema: ${schemaName}.${tableName}`,
    },
    {
      uri: new URL(`${tablePrefix}/${RESOURCE_PATHS.SAMPLE}`, resourceBaseUrl)
        .href,
      mimeType: MIME_TYPES.JSON,
      name: `Sample Data: ${schemaName}.${tableName}`,
    },
    {
      uri: new URL(
        `${tablePrefix}/${RESOURCE_PATHS.STATISTICS}`,
        resourceBaseUrl,
      ).href,
      mimeType: MIME_TYPES.JSON,
      name: `Statistics: ${schemaName}.${tableName}`,
    },
    {
      uri: new URL(
        `${tablePrefix}/${RESOURCE_PATHS.DEPENDENCIES}`,
        resourceBaseUrl,
      ).href,
      mimeType: MIME_TYPES.JSON,
      name: `Dependencies: ${schemaName}.${tableName}`,
    },
  );
}

/**
 * Add global resources to the resource list
 *
 * @param resourceBaseUrl - Base URL for constructing resource URIs
 * @param resources - Array to add resources to
 */
function addGlobalResources(
  resourceBaseUrl: URL,
  resources: Array<{ uri: string; mimeType: string; name: string }>,
): void {
  resources.push(
    {
      uri: new URL(RESOURCE_PATHS.QUERY_HISTORY, resourceBaseUrl).href,
      mimeType: MIME_TYPES.JSON,
      name: "Query History",
    },
    {
      uri: new URL(RESOURCE_PATHS.PERMISSIONS, resourceBaseUrl).href,
      mimeType: MIME_TYPES.JSON,
      name: "User Permissions",
    },
  );
}

/**
 * Handle MCP ReadResource request - returns content for a specific resource
 *
 * @param pool - Database connection pool
 * @param uri - Resource URI to read
 * @returns Promise resolving to MCP resource content response
 */
export async function handleReadResource(
  pool: Pool,
  uri: string,
): Promise<{
  contents: Array<{ uri: string; mimeType: string; text: string }>;
}> {
  const resourceUrl = new URL(uri);
  const pathComponents = resourceUrl.pathname
    .split("/")
    .filter((p) => p !== "");

  // Handle global resources (single path component)
  if (pathComponents.length === 1) {
    return await handleGlobalResource(pool, pathComponents[0], uri);
  }

  // Handle schema listing (two path components: schema/schemaName)
  if (
    pathComponents.length === 2 &&
    pathComponents[0] === RESOURCE_PATHS.SCHEMA
  ) {
    return await handleSchemaResource(pool, pathComponents[1], uri);
  }

  // Handle table-specific resources (three path components: schema/table/resourceType)
  if (pathComponents.length === 3) {
    return await handleTableResource(
      pool,
      pathComponents[0], // schemaName
      pathComponents[1], // tableName
      pathComponents[2], // resourceType
      uri,
    );
  }

  throw new Error("Invalid resource URI");
}

/**
 * Handle global resource requests (query history, permissions)
 *
 * @param pool - Database connection pool
 * @param resourceType - Type of global resource
 * @param uri - Original resource URI
 * @returns Promise resolving to resource content
 */
async function handleGlobalResource(
  pool: Pool,
  resourceType: string,
  uri: string,
): Promise<{
  contents: Array<{ uri: string; mimeType: string; text: string }>;
}> {
  const client = await pool.connect();

  try {
    let data: QueryHistory[] | UserPermission[];

    if (resourceType === RESOURCE_PATHS.QUERY_HISTORY) {
      data = await DatabaseOperations.getQueryHistory(client);
    } else if (resourceType === RESOURCE_PATHS.PERMISSIONS) {
      data = await DatabaseOperations.getUserPermissions(client);
    } else {
      throw new Error(`Unknown global resource type: ${resourceType}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: MIME_TYPES.JSON,
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  } finally {
    client.release();
  }
}

/**
 * Handle schema resource requests (table listings)
 *
 * @param pool - Database connection pool
 * @param schemaName - Name of the schema
 * @param uri - Original resource URI
 * @returns Promise resolving to resource content
 */
async function handleSchemaResource(
  pool: Pool,
  schemaName: string,
  uri: string,
): Promise<{
  contents: Array<{ uri: string; mimeType: string; text: string }>;
}> {
  const client = await pool.connect();

  try {
    const tables = await DatabaseOperations.getTables(client, schemaName);

    return {
      contents: [
        {
          uri,
          mimeType: MIME_TYPES.JSON,
          text: JSON.stringify(tables, null, 2),
        },
      ],
    };
  } finally {
    client.release();
  }
}

/**
 * Handle table-specific resource requests
 *
 * @param pool - Database connection pool
 * @param schemaName - Name of the schema
 * @param tableName - Name of the table
 * @param resourceType - Type of table resource
 * @param uri - Original resource URI
 * @returns Promise resolving to resource content
 */
async function handleTableResource(
  pool: Pool,
  schemaName: string,
  tableName: string,
  resourceType: string,
  uri: string,
): Promise<{
  contents: Array<{ uri: string; mimeType: string; text: string }>;
}> {
  const client = await pool.connect();

  try {
    let data:
      | RedshiftColumn[]
      | DatabaseRow[]
      | RedshiftStatistics[]
      | TableDependency[];

    switch (resourceType) {
      case RESOURCE_PATHS.SCHEMA: {
        data = await DatabaseOperations.getTableColumns(
          client,
          schemaName,
          tableName,
        );
        break;
      }
      case RESOURCE_PATHS.SAMPLE: {
        data = await DatabaseOperations.getSampleData(
          client,
          schemaName,
          tableName,
        );
        break;
      }
      case RESOURCE_PATHS.STATISTICS: {
        data = await DatabaseOperations.getTableStatistics(
          client,
          schemaName,
          tableName,
        );
        break;
      }
      case RESOURCE_PATHS.DEPENDENCIES: {
        data = await DatabaseOperations.getTableDependencies(
          client,
          schemaName,
          tableName,
        );
        break;
      }
      default: {
        throw new Error(`Unknown resource type: ${resourceType}`);
      }
    }

    return {
      contents: [
        {
          uri,
          mimeType: MIME_TYPES.JSON,
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  } finally {
    client.release();
  }
}
