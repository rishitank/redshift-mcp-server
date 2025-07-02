/**
 * Configuration Loader for Pluggable Logging System
 *
 * Loads logging configuration from environment variables and config files
 */

import { readFileSync } from "node:fs";
import { LoggingLevel } from "@modelcontextprotocol/sdk/types";
import { PACKAGE_NAME } from "../constants";
import {
  LoggingManagerConfig,
  WinstonLoggingConfig,
  WinstonTransportConfig,
} from "./interfaces";

/**
 * Load logging configuration from environment variables and config files
 */
export function loadLoggingConfig(): LoggingManagerConfig {
  // Try to load from config file first
  const configFile = process.env.REDSHIFT_LOGGING_CONFIG_FILE;
  if (configFile) {
    try {
      const fileContent = readFileSync(configFile, "utf-8");
      const fileConfig = JSON.parse(fileContent);
      return mergeWithEnvConfig(fileConfig);
    } catch (error) {
      console.warn(`Failed to load logging config from ${configFile}:`, error);
    }
  }

  // Load from environment variables
  return loadFromEnvironment();
}

/**
 * Load configuration from environment variables
 */
function loadFromEnvironment(): LoggingManagerConfig {
  const config: LoggingManagerConfig = {
    defaultLevel: parseLogLevel(process.env.REDSHIFT_LOG_LEVEL) || "info",
    enabled: process.env.REDSHIFT_LOGGING_ENABLED !== "false",
    globalMetadata: {
      service: PACKAGE_NAME,
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "production",
    },
    backends: {},
  };

  // MCP Backend (always enabled for MCP notifications)
  config.backends.mcp = {
    enabled: true,
    logLevel:
      parseLogLevel(process.env.REDSHIFT_MCP_LOG_LEVEL) || config.defaultLevel,
  };

  // Console Backend
  if (process.env.REDSHIFT_CONSOLE_LOGGING !== "false") {
    config.backends.console = {
      enabled: true,
      colorize: process.env.REDSHIFT_CONSOLE_COLORIZE !== "false",
      format:
        (process.env.REDSHIFT_CONSOLE_FORMAT as "json" | "pretty") || "pretty",
      logLevel:
        parseLogLevel(process.env.REDSHIFT_CONSOLE_LOG_LEVEL) ||
        config.defaultLevel,
    };
  }

  // HTTP Backend
  if (process.env.REDSHIFT_HTTP_LOG_URL) {
    config.backends.http = {
      enabled: true,
      url: process.env.REDSHIFT_HTTP_LOG_URL,
      method:
        (process.env.REDSHIFT_HTTP_LOG_METHOD as "POST" | "PUT") || "POST",
      apiKey: process.env.REDSHIFT_HTTP_LOG_API_KEY,
      batchSize: Number.parseInt(
        process.env.REDSHIFT_HTTP_LOG_BATCH_SIZE || "10",
      ),
      flushInterval: Number.parseInt(
        process.env.REDSHIFT_HTTP_LOG_FLUSH_INTERVAL || "5000",
      ),
      timeout: Number.parseInt(
        process.env.REDSHIFT_HTTP_LOG_TIMEOUT || "10000",
      ),
      retryAttempts: Number.parseInt(
        process.env.REDSHIFT_HTTP_LOG_RETRY_ATTEMPTS || "3",
      ),
      logLevel:
        parseLogLevel(process.env.REDSHIFT_HTTP_LOG_LEVEL) ||
        config.defaultLevel,
      headers: parseHeaders(process.env.REDSHIFT_HTTP_LOG_HEADERS),
    };
  }

  // Datadog Backend
  if (process.env.REDSHIFT_DATADOG_API_KEY) {
    config.backends.datadog = {
      enabled: true,
      apiKey: process.env.REDSHIFT_DATADOG_API_KEY,
      site: process.env.REDSHIFT_DATADOG_SITE || "datadoghq.com",
      service: process.env.REDSHIFT_DATADOG_SERVICE || PACKAGE_NAME,
      source: process.env.REDSHIFT_DATADOG_SOURCE || PACKAGE_NAME,
      tags: parseTags(process.env.REDSHIFT_DATADOG_TAGS),
      batchSize: Number.parseInt(
        process.env.REDSHIFT_DATADOG_BATCH_SIZE || "25",
      ),
      flushInterval: Number.parseInt(
        process.env.REDSHIFT_DATADOG_FLUSH_INTERVAL || "10000",
      ),
      timeout: Number.parseInt(process.env.REDSHIFT_DATADOG_TIMEOUT || "10000"),
      retryAttempts: Number.parseInt(
        process.env.REDSHIFT_DATADOG_RETRY_ATTEMPTS || "3",
      ),
      logLevel:
        parseLogLevel(process.env.REDSHIFT_DATADOG_LOG_LEVEL) ||
        config.defaultLevel,
    };
  }

  // New Relic Backend
  if (process.env.REDSHIFT_NEWRELIC_LICENSE_KEY) {
    config.backends.newrelic = {
      enabled: true,
      licenseKey: process.env.REDSHIFT_NEWRELIC_LICENSE_KEY,
      endpoint: process.env.REDSHIFT_NEWRELIC_ENDPOINT,
      batchSize: Number.parseInt(
        process.env.REDSHIFT_NEWRELIC_BATCH_SIZE || "25",
      ),
      flushInterval: Number.parseInt(
        process.env.REDSHIFT_NEWRELIC_FLUSH_INTERVAL || "10000",
      ),
      timeout: Number.parseInt(
        process.env.REDSHIFT_NEWRELIC_TIMEOUT || "10000",
      ),
      retryAttempts: Number.parseInt(
        process.env.REDSHIFT_NEWRELIC_RETRY_ATTEMPTS || "3",
      ),
      logLevel:
        parseLogLevel(process.env.REDSHIFT_NEWRELIC_LOG_LEVEL) ||
        config.defaultLevel,
    };
  }

  // Splunk Backend
  if (process.env.REDSHIFT_SPLUNK_URL && process.env.REDSHIFT_SPLUNK_TOKEN) {
    config.backends.splunk = {
      enabled: true,
      url: process.env.REDSHIFT_SPLUNK_URL,
      token: process.env.REDSHIFT_SPLUNK_TOKEN,
      index: process.env.REDSHIFT_SPLUNK_INDEX,
      source: process.env.REDSHIFT_SPLUNK_SOURCE || PACKAGE_NAME,
      sourceType: process.env.REDSHIFT_SPLUNK_SOURCE_TYPE || "json",
      batchSize: Number.parseInt(
        process.env.REDSHIFT_SPLUNK_BATCH_SIZE || "25",
      ),
      flushInterval: Number.parseInt(
        process.env.REDSHIFT_SPLUNK_FLUSH_INTERVAL || "10000",
      ),
      timeout: Number.parseInt(process.env.REDSHIFT_SPLUNK_TIMEOUT || "10000"),
      retryAttempts: Number.parseInt(
        process.env.REDSHIFT_SPLUNK_RETRY_ATTEMPTS || "3",
      ),
      logLevel:
        parseLogLevel(process.env.REDSHIFT_SPLUNK_LOG_LEVEL) ||
        config.defaultLevel,
    };
  }

  // Elasticsearch Backend
  if (process.env.REDSHIFT_ELASTICSEARCH_URL) {
    config.backends.elasticsearch = {
      enabled: true,
      url: process.env.REDSHIFT_ELASTICSEARCH_URL,
      index: process.env.REDSHIFT_ELASTICSEARCH_INDEX || PACKAGE_NAME,
      username: process.env.REDSHIFT_ELASTICSEARCH_USERNAME,
      password: process.env.REDSHIFT_ELASTICSEARCH_PASSWORD,
      apiKey: process.env.REDSHIFT_ELASTICSEARCH_API_KEY,
      cloudId: process.env.REDSHIFT_ELASTICSEARCH_CLOUD_ID,
      batchSize: Number.parseInt(
        process.env.REDSHIFT_ELASTICSEARCH_BATCH_SIZE || "25",
      ),
      flushInterval: Number.parseInt(
        process.env.REDSHIFT_ELASTICSEARCH_FLUSH_INTERVAL || "10000",
      ),
      timeout: Number.parseInt(
        process.env.REDSHIFT_ELASTICSEARCH_TIMEOUT || "10000",
      ),
      retryAttempts: Number.parseInt(
        process.env.REDSHIFT_ELASTICSEARCH_RETRY_ATTEMPTS || "3",
      ),
      logLevel:
        parseLogLevel(process.env.REDSHIFT_ELASTICSEARCH_LOG_LEVEL) ||
        config.defaultLevel,
    };
  }

  // Sentry Backend
  if (process.env.REDSHIFT_SENTRY_DSN) {
    config.backends.sentry = {
      enabled: true,
      dsn: process.env.REDSHIFT_SENTRY_DSN,
      environment:
        process.env.REDSHIFT_SENTRY_ENVIRONMENT ||
        process.env.NODE_ENV ||
        "production",
      release:
        process.env.REDSHIFT_SENTRY_RELEASE || process.env.npm_package_version,
      serverName:
        process.env.REDSHIFT_SENTRY_SERVER_NAME || process.env.HOSTNAME,
      sampleRate: Number.parseFloat(
        process.env.REDSHIFT_SENTRY_SAMPLE_RATE || "1.0",
      ),
      tracesSampleRate: Number.parseFloat(
        process.env.REDSHIFT_SENTRY_TRACES_SAMPLE_RATE || "0.1",
      ),
      profilesSampleRate: Number.parseFloat(
        process.env.REDSHIFT_SENTRY_PROFILES_SAMPLE_RATE || "0.1",
      ),
      debug: process.env.REDSHIFT_SENTRY_DEBUG === "true",
      enablePerformanceMonitoring:
        process.env.REDSHIFT_SENTRY_PERFORMANCE !== "false",
      enableProfiling: process.env.REDSHIFT_SENTRY_PROFILING === "true",
      tags: parseTags(process.env.REDSHIFT_SENTRY_TAGS),
      logLevel:
        parseLogLevel(process.env.REDSHIFT_SENTRY_LOG_LEVEL) ||
        config.defaultLevel,
    };
  }

  return config;
}

/**
 * Merge file configuration with environment variables
 */
function mergeWithEnvConfig(
  fileConfig: Partial<LoggingManagerConfig>,
): LoggingManagerConfig {
  const envConfig = loadFromEnvironment();

  // Environment variables take precedence
  return {
    ...fileConfig,
    ...envConfig,
    backends: {
      ...fileConfig.backends,
      ...envConfig.backends,
    },
    globalMetadata: {
      ...fileConfig.globalMetadata,
      ...envConfig.globalMetadata,
    },
  } as LoggingManagerConfig;
}

/**
 * Parse log level from string
 */
function parseLogLevel(level?: string): LoggingLevel | undefined {
  if (!level) return undefined;

  const normalizedLevel = level.toLowerCase() as LoggingLevel;
  const validLevels: LoggingLevel[] = [
    "debug",
    "info",
    "notice",
    "warning",
    "error",
    "critical",
    "alert",
    "emergency",
  ];

  return validLevels.includes(normalizedLevel) ? normalizedLevel : undefined;
}

/**
 * Parse headers from environment variable
 */
function parseHeaders(headersStr?: string): Record<string, string> | undefined {
  if (!headersStr) return undefined;

  try {
    return JSON.parse(headersStr);
  } catch {
    // Try simple key=value format
    const headers: Record<string, string> = {};
    for (const pair of headersStr.split(",")) {
      const [key, value] = pair.split("=");
      if (key && value) {
        headers[key.trim()] = value.trim();
      }
    }
    return Object.keys(headers).length > 0 ? headers : undefined;
  }
}

/**
 * Parse tags from environment variable
 */
function parseTags(tagsStr?: string): string[] | undefined {
  if (!tagsStr) return undefined;

  return tagsStr
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/**
 * Convert LoggingManagerConfig to WinstonLoggingConfig for backward compatibility
 */
export function convertToWinstonConfig(
  config: LoggingManagerConfig,
): WinstonLoggingConfig {
  const transports: WinstonTransportConfig[] = [];

  // Convert each backend to Winston transport configuration
  for (const [backendName, backendConfig] of Object.entries(config.backends)) {
    if (!backendConfig?.enabled) {
      continue;
    }

    // Map backend names to Winston transport types
    let transportType: WinstonTransportConfig["type"];
    switch (backendName) {
      case "console": {
        transportType = "console";
        break;
      }
      case "http": {
        transportType = "http";
        break;
      }
      case "file": {
        transportType = "file";
        break;
      }
      case "datadog": {
        transportType = "datadog";
        break;
      }
      case "sentry": {
        transportType = "sentry";
        break;
      }
      case "mcp": {
        transportType = "mcp";
        break;
      }
      default: {
        // Skip unknown backend types
        continue;
      }
    }

    transports.push({
      type: transportType,
      config: backendConfig,
      level: backendConfig.logLevel || config.defaultLevel,
      enabled: backendConfig.enabled,
    });
  }

  return {
    level: config.defaultLevel,
    enabled: config.enabled,
    globalMetadata: config.globalMetadata,
    transports,
    generateCorrelationId: config.generateCorrelationId,
  };
}

/**
 * Load Winston-compatible logging configuration
 */
export function loadWinstonLoggingConfig(): WinstonLoggingConfig {
  const legacyConfig = loadLoggingConfig();
  return convertToWinstonConfig(legacyConfig);
}
