/**
 * Logging Interfaces for Pluggable Logging Architecture
 *
 * This module defines interfaces for pluggable logging backends,
 * allowing integration with various monitoring and logging solutions.
 */

import { LoggingLevel } from "@modelcontextprotocol/sdk/types";

/**
 * Log entry structure
 */
export interface LogEntry {
  level: LoggingLevel;
  message: string;
  timestamp: string;
  component?: string;
  event?: string;
  data?: Record<string, unknown>;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  queryId?: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logging backend interface that all logging providers must implement
 */
export interface LoggingBackend {
  /**
   * Unique identifier for the logging backend
   */
  readonly name: string;

  /**
   * Initialize the logging backend
   */
  initialize(config: LoggingBackendConfig): Promise<void>;

  /**
   * Send a log entry to the backend
   */
  log(entry: LogEntry): Promise<void>;

  /**
   * Send multiple log entries in batch
   */
  logBatch(entries: LogEntry[]): Promise<void>;

  /**
   * Flush any pending log entries
   */
  flush(): Promise<void>;

  /**
   * Close the logging backend and cleanup resources
   */
  close(): Promise<void>;

  /**
   * Health check for the logging backend
   */
  isHealthy(): Promise<boolean>;
}

/**
 * Configuration for logging backends
 */
export interface LoggingBackendConfig {
  /**
   * Backend-specific configuration
   */
  [key: string]: unknown;

  /**
   * Common configuration options
   */
  enabled?: boolean;
  batchSize?: number;
  flushInterval?: number;
  retryAttempts?: number;
  timeout?: number;
  logLevel?: LoggingLevel;
}

/**
 * HTTP-based logging backend configuration
 */
export interface HttpLoggingConfig extends LoggingBackendConfig {
  url: string;
  headers?: Record<string, string>;
  method?: "POST" | "PUT";
  apiKey?: string;
  format?: "json" | "logfmt" | "custom";
  customFormatter?: (entry: LogEntry) => unknown;
}

/**
 * File-based logging backend configuration
 */
export interface FileLoggingConfig extends LoggingBackendConfig {
  filePath: string;
  maxFileSize?: number;
  maxFiles?: number;
  format?: "json" | "text";
  rotation?: "daily" | "size" | "none";
}

/**
 * Syslog backend configuration
 */
export interface SyslogConfig extends LoggingBackendConfig {
  host: string;
  port?: number;
  protocol?: "udp" | "tcp" | "tls";
  facility?: string;
  tag?: string;
}

/**
 * Console logging backend configuration
 */
export interface ConsoleLoggingConfig extends LoggingBackendConfig {
  colorize?: boolean;
  format?: "json" | "pretty";
}

/**
 * Datadog logging backend configuration
 */
export interface DatadogConfig extends LoggingBackendConfig {
  apiKey: string;
  site?: string; // e.g., 'datadoghq.com', 'datadoghq.eu'
  service: string;
  source?: string;
  tags?: string[];
}

/**
 * New Relic logging backend configuration
 */
export interface NewRelicConfig extends LoggingBackendConfig {
  licenseKey: string;
  endpoint?: string;
  attributes?: Record<string, string>;
}

/**
 * Splunk logging backend configuration
 */
export interface SplunkConfig extends LoggingBackendConfig {
  url: string;
  token: string;
  index?: string;
  source?: string;
  sourceType?: string;
}

/**
 * Elasticsearch logging backend configuration
 */
export interface ElasticsearchConfig extends LoggingBackendConfig {
  url: string;
  index: string;
  username?: string;
  password?: string;
  apiKey?: string;
  cloudId?: string;
}

/**
 * Sentry logging backend configuration
 */
export interface SentryConfig extends LoggingBackendConfig {
  dsn: string;
  environment?: string;
  release?: string;
  serverName?: string;
  sampleRate?: number;
  tracesSampleRate?: number;
  profilesSampleRate?: number;
  debug?: boolean;
  beforeSend?: string; // Function name for custom filtering
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  integrations?: string[]; // Integration names to enable
  enablePerformanceMonitoring?: boolean;
  enableProfiling?: boolean;
}

/**
 * MCP logging backend configuration
 */
export interface MCPConfig extends LoggingBackendConfig {
  // MCP transport doesn't require additional configuration
  // Server instance is set externally via setServer method
}

/**
 * Logging manager configuration
 */
export interface LoggingManagerConfig {
  /**
   * Default log level
   */
  defaultLevel: LoggingLevel;

  /**
   * Enable/disable logging entirely
   */
  enabled: boolean;

  /**
   * Correlation ID generation function
   */
  generateCorrelationId?: () => string;

  /**
   * Global metadata to include in all log entries
   */
  globalMetadata?: Record<string, unknown>;

  /**
   * Backends configuration
   */
  backends: {
    mcp?: LoggingBackendConfig;
    http?: HttpLoggingConfig;
    file?: FileLoggingConfig;
    console?: ConsoleLoggingConfig;
    syslog?: SyslogConfig;
    datadog?: DatadogConfig;
    newrelic?: NewRelicConfig;
    splunk?: SplunkConfig;
    elasticsearch?: ElasticsearchConfig;
    sentry?: SentryConfig;
    [key: string]: LoggingBackendConfig | undefined;
  };
}

/**
 * Logging context for request/operation tracking
 */
export interface LoggingContext {
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  queryId?: string;
  operation?: string;
  startTime?: number;
}

/**
 * Database logging manager interface for type safety
 * Used by database operations to log activities
 */
export interface DatabaseLoggingManager {
  /**
   * Log an informational message
   */
  info(
    message: string,
    data?: Record<string, unknown>,
    context?: LoggingContext,
  ): Promise<void>;

  /**
   * Log an error message with optional error object
   */
  error(
    message: string,
    error?: Error,
    data?: Record<string, unknown>,
    context?: LoggingContext,
  ): Promise<void>;

  /**
   * Log a debug message
   */
  debug(
    message: string,
    data?: Record<string, unknown>,
    context?: LoggingContext,
  ): Promise<void>;

  /**
   * Log a warning message
   */
  warning(
    message: string,
    data?: Record<string, unknown>,
    context?: LoggingContext,
  ): Promise<void>;

  /**
   * Start a performance transaction (for monitoring)
   */
  startTransaction(
    name: string,
    operation: string,
    correlationId?: string,
  ): string;

  /**
   * Finish a performance transaction
   */
  finishTransaction(transactionId: string, status?: string): void;

  /**
   * Set global logging context
   */
  setGlobalContext(context: Partial<LoggingContext>): void;

  /**
   * Create a scoped logger with specific context
   */
  createScopedLogger(context: LoggingContext): ScopedLogger;

  /**
   * Get health status of all backends
   */
  getHealthStatus(): Promise<Record<string, boolean>>;

  /**
   * Flush all pending logs
   */
  flush(): Promise<void>;

  /**
   * Close and cleanup all resources
   */
  close(): Promise<void>;
}

/**
 * Scoped logger interface for type safety
 */
export interface ScopedLogger {
  debug(message: string, data?: Record<string, unknown>): Promise<void>;
  info(message: string, data?: Record<string, unknown>): Promise<void>;
  warning(message: string, data?: Record<string, unknown>): Promise<void>;
  error(
    message: string,
    error?: Error,
    data?: Record<string, unknown>,
  ): Promise<void>;
}

/**
 * Extended logging backend interface for backends with performance monitoring
 */
export interface PerformanceLoggingBackend extends LoggingBackend {
  /**
   * Start a performance transaction
   */
  startTransaction(
    name: string,
    operation: string,
    correlationId?: string,
  ): string;

  /**
   * Finish a performance transaction
   */
  finishTransaction(transactionId: string, status?: string): void;
}

/**
 * Winston-specific configuration interface
 */
export interface WinstonLoggingConfig {
  /**
   * Winston log level
   */
  level: string;

  /**
   * Global metadata to include in all log entries
   */
  globalMetadata?: Record<string, unknown>;

  /**
   * Transport configurations for Winston
   */
  transports: WinstonTransportConfig[];

  /**
   * Enable/disable logging entirely
   */
  enabled?: boolean;

  /**
   * Correlation ID generation function
   */
  generateCorrelationId?: () => string;
}

/**
 * Winston transport configuration
 */
export interface WinstonTransportConfig {
  /**
   * Transport type (console, http, file, datadog, sentry, mcp)
   */
  type: "console" | "http" | "file" | "datadog" | "sentry" | "mcp";

  /**
   * Transport-specific configuration
   */
  config: LoggingBackendConfig;

  /**
   * Transport log level override
   */
  level?: string;

  /**
   * Enable/disable this transport
   */
  enabled?: boolean;
}
