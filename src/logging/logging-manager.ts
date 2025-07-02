/**
 * Pluggable Logging Manager for Redshift MCP Server
 *
 * This module provides a flexible logging architecture that supports
 * multiple logging backends for integration with various monitoring solutions.
 */

import { randomUUID } from "node:crypto";
import { LoggingLevel } from "@modelcontextprotocol/sdk/types";
import {
  LogEntry,
  LoggingBackend,
  LoggingBackendConfig,
  LoggingManagerConfig,
  LoggingContext,
  HttpLoggingConfig,
  FileLoggingConfig,
  DatadogConfig,
  NewRelicConfig,
  SplunkConfig,
  ElasticsearchConfig,
  SentryConfig,
  PerformanceLoggingBackend,
} from "./interfaces";

/**
 * Pluggable logging manager that supports multiple backends
 */
export class LoggingManager {
  private backends: Map<string, LoggingBackend> = new Map();
  private config: LoggingManagerConfig;
  private globalContext: LoggingContext = {};
  private isInitialized = false;

  // === BATCH PROCESSING INTEGRATION ===
  private pendingEntries: LogEntry[] = [];
  private batchFlushTimer?: ReturnType<typeof setTimeout>;
  private readonly BATCH_SIZE_THRESHOLD = 10; // Batch when we have 10+ entries
  private readonly BATCH_FLUSH_INTERVAL = 5000; // Flush every 5 seconds

  constructor(config: LoggingManagerConfig) {
    this.config = config;
  }

  /**
   * Initialize the logging manager and all configured backends
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize all configured backends
      const backendPromises = Object.entries(this.config.backends)
        .filter(([, config]) => config?.enabled !== false)
        .map(async ([name, config]) => {
          try {
            const backend = await this.createBackend(name, config!);
            if (backend) {
              await backend.initialize(config!);
              this.backends.set(name, backend);
              console.log(`✅ Initialized logging backend: ${name}`);
            }
          } catch (error) {
            console.error(
              `❌ Failed to initialize logging backend ${name}:`,
              error,
            );
          }
        });

      await Promise.allSettled(backendPromises);
      this.isInitialized = true;

      await this.log("info", "Logging manager initialized", {
        component: "logging-manager",
        backends: [...this.backends.keys()],
      });
    } catch (error) {
      console.error("Failed to initialize logging manager:", error);
      throw error;
    }
  }

  /**
   * Create a backend instance based on configuration
   */
  private async createBackend(
    name: string,
    config: LoggingBackendConfig,
  ): Promise<LoggingBackend | null> {
    try {
      // === PROPER CONFIG USAGE: Validate and use configuration ===

      // Skip disabled backends
      if (config.enabled === false) {
        console.log(`⏭️ Skipping disabled backend: ${name}`);
        return null;
      }

      // Validate required configuration based on backend type
      if (!this.validateBackendConfig(name, config)) {
        console.error(`❌ Invalid configuration for backend ${name}`);
        return null;
      }

      console.log(`🔧 Creating backend ${name} with config:`, {
        enabled: config.enabled,
        batchSize: config.batchSize,
        logLevel: config.logLevel,
        hasCustomConfig: Object.keys(config).length > 3,
      });

      switch (name) {
        case "mcp": {
          const { MCPLoggingBackend } = await import("./backends/mcp-backend");
          return new MCPLoggingBackend();
        }

        case "http": {
          const { HttpLoggingBackend } = await import(
            "./backends/http-backend"
          );
          const httpConfig = config as HttpLoggingConfig;
          if (!httpConfig.url) {
            throw new Error("HTTP backend requires url configuration");
          }
          return new HttpLoggingBackend();
        }

        case "file": {
          const { FileLoggingBackend } = await import(
            "./backends/file-backend"
          );
          const fileConfig = config as FileLoggingConfig;
          if (!fileConfig.filePath) {
            throw new Error("File backend requires filePath configuration");
          }
          return new FileLoggingBackend();
        }

        case "console": {
          const { ConsoleLoggingBackend } = await import(
            "./backends/console-backend"
          );
          return new ConsoleLoggingBackend();
        }

        case "datadog": {
          const { DatadogLoggingBackend } = await import(
            "./backends/datadog-backend"
          );
          const datadogConfig = config as DatadogConfig;
          if (!datadogConfig.apiKey || !datadogConfig.service) {
            throw new Error(
              "Datadog backend requires apiKey and service configuration",
            );
          }
          return new DatadogLoggingBackend();
        }

        case "newrelic": {
          const { NewRelicLoggingBackend } = await import(
            "./backends/newrelic-backend"
          );
          const newrelicConfig = config as NewRelicConfig;
          if (!newrelicConfig.licenseKey) {
            throw new Error(
              "New Relic backend requires licenseKey configuration",
            );
          }
          return new NewRelicLoggingBackend();
        }

        case "splunk": {
          const { SplunkLoggingBackend } = await import(
            "./backends/splunk-backend"
          );
          const splunkConfig = config as SplunkConfig;
          if (!splunkConfig.url || !splunkConfig.token) {
            throw new Error(
              "Splunk backend requires url and token configuration",
            );
          }
          return new SplunkLoggingBackend();
        }

        case "elasticsearch": {
          const { ElasticsearchLoggingBackend } = await import(
            "./backends/elasticsearch-backend"
          );
          const esConfig = config as ElasticsearchConfig;
          if (!esConfig.url || !esConfig.index) {
            throw new Error(
              "Elasticsearch backend requires url and index configuration",
            );
          }
          return new ElasticsearchLoggingBackend();
        }

        case "sentry": {
          const { SentryLoggingBackend } = await import(
            "./backends/sentry-backend"
          );
          const sentryConfig = config as SentryConfig;
          if (!sentryConfig.dsn) {
            throw new Error("Sentry backend requires dsn configuration");
          }
          return new SentryLoggingBackend();
        }

        default: {
          console.warn(`Unknown logging backend: ${name}`);
          return null;
        }
      }
    } catch (error) {
      console.error(`Failed to create backend ${name}:`, error);
      return null;
    }
  }

  /**
   * Validate backend configuration based on backend type
   */
  private validateBackendConfig(
    name: string,
    config: LoggingBackendConfig,
  ): boolean {
    try {
      // Basic validation for all backends
      if (typeof config !== "object" || config === null) {
        return false;
      }

      // Validate common properties
      if (
        config.batchSize !== undefined &&
        (config.batchSize < 1 || config.batchSize > 1000)
      ) {
        console.error(
          `Invalid batchSize for ${name}: must be between 1 and 1000`,
        );
        return false;
      }

      if (config.flushInterval !== undefined && config.flushInterval < 0) {
        console.error(
          `Invalid flushInterval for ${name}: must be non-negative`,
        );
        return false;
      }

      // Backend-specific validation
      switch (name) {
        case "http": {
          const httpConfig = config as HttpLoggingConfig;
          return Boolean(httpConfig.url);
        }
        case "file": {
          const fileConfig = config as FileLoggingConfig;
          return Boolean(fileConfig.filePath);
        }
        case "datadog": {
          const datadogConfig = config as DatadogConfig;
          return Boolean(datadogConfig.apiKey && datadogConfig.service);
        }
        case "newrelic": {
          const newrelicConfig = config as NewRelicConfig;
          return Boolean(newrelicConfig.licenseKey);
        }
        case "splunk": {
          const splunkConfig = config as SplunkConfig;
          return Boolean(splunkConfig.url && splunkConfig.token);
        }
        case "elasticsearch": {
          const esConfig = config as ElasticsearchConfig;
          return Boolean(esConfig.url && esConfig.index);
        }
        case "sentry": {
          const sentryConfig = config as SentryConfig;
          return Boolean(sentryConfig.dsn);
        }
        default: {
          // For unknown backends or simple backends like console/mcp, basic validation is sufficient
          return true;
        }
      }
    } catch (error) {
      console.error(`Error validating config for ${name}:`, error);
      return false;
    }
  }

  /**
   * Set global logging context
   */
  setGlobalContext(context: Partial<LoggingContext>): void {
    this.globalContext = {
      ...this.globalContext,
      ...context,
    };
  }

  /**
   * Create a scoped logger with specific context
   */
  createScopedLogger(context: LoggingContext): ScopedLogger {
    return new ScopedLogger(this, context);
  }

  /**
   * Log a message to all configured backends
   */
  async log(
    level: LoggingLevel,
    message: string,
    data?: Record<string, unknown>,
    context?: LoggingContext,
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      correlationId:
        context?.correlationId ||
        this.globalContext.correlationId ||
        this.generateCorrelationId(),
      userId: context?.userId || this.globalContext.userId,
      sessionId: context?.sessionId || this.globalContext.sessionId,
      queryId: context?.queryId || this.globalContext.queryId,
      duration: context?.startTime ? Date.now() - context.startTime : undefined,
      data: {
        ...this.config.globalMetadata,
        ...data,
      },
    };

    // === BATCH PROCESSING INTEGRATION ===
    // For high-volume scenarios, use batch processing
    if (this.shouldUseBatchProcessing()) {
      this.pendingEntries.push(entry);

      // Flush immediately if batch is full
      if (this.pendingEntries.length >= this.BATCH_SIZE_THRESHOLD) {
        await this.flushPendingEntries();
      } else {
        // Set up timer to flush pending entries
        this.scheduleBatchFlush();
      }
    } else {
      // Send immediately for low-volume scenarios
      const promises = [...this.backends.values()].map(async (backend) => {
        try {
          await backend.log(entry);
        } catch (error) {
          console.error(`Failed to log to backend ${backend.name}:`, error);
        }
      });

      await Promise.allSettled(promises);
    }
  }

  /**
   * Convenience methods for different log levels
   */
  async debug(
    message: string,
    data?: Record<string, unknown>,
    context?: LoggingContext,
  ): Promise<void> {
    await this.log("debug", message, data, context);
  }

  async info(
    message: string,
    data?: Record<string, unknown>,
    context?: LoggingContext,
  ): Promise<void> {
    await this.log("info", message, data, context);
  }

  async warning(
    message: string,
    data?: Record<string, unknown>,
    context?: LoggingContext,
  ): Promise<void> {
    await this.log("warning", message, data, context);
  }

  async error(
    message: string,
    error?: Error,
    data?: Record<string, unknown>,
    context?: LoggingContext,
  ): Promise<void> {
    const errorData = error
      ? {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        }
      : {};

    await this.log(
      "error",
      message,
      {
        ...errorData,
        ...data,
      },
      context,
    );
  }

  /**
   * Flush all backends
   */
  async flush(): Promise<void> {
    const promises = [...this.backends.values()].map((backend) =>
      backend.flush(),
    );
    await Promise.allSettled(promises);
  }

  /**
   * Close all backends and cleanup
   */
  async close(): Promise<void> {
    // === BATCH PROCESSING CLEANUP ===
    // Clear batch flush timer
    if (this.batchFlushTimer) {
      clearTimeout(this.batchFlushTimer);
    }

    // Flush any pending batch entries
    await this.flushPendingEntries();

    await this.flush();
    const promises = [...this.backends.values()].map((backend) =>
      backend.close(),
    );
    await Promise.allSettled(promises);
    this.backends.clear();
    this.isInitialized = false;
  }

  /**
   * Generate a correlation ID
   */
  private generateCorrelationId(): string {
    return this.config.generateCorrelationId?.() || randomUUID();
  }

  /**
   * Get health status of all backends
   */
  async getHealthStatus(): Promise<Record<string, boolean>> {
    const status: Record<string, boolean> = {};

    const promises = [...this.backends.entries()].map(
      async ([name, backend]) => {
        try {
          status[name] = await backend.isHealthy();
        } catch {
          status[name] = false;
        }
      },
    );

    await Promise.allSettled(promises);
    return status;
  }

  /**
   * Start a performance transaction (Sentry integration)
   */
  startTransaction(
    name: string,
    operation: string,
    correlationId?: string,
  ): string {
    const sentryBackend = this.backends.get("sentry");
    if (sentryBackend && this.isPerformanceBackend(sentryBackend)) {
      return sentryBackend.startTransaction(name, operation, correlationId);
    }
    return correlationId || this.generateCorrelationId();
  }

  /**
   * Finish a performance transaction (Sentry integration)
   */
  finishTransaction(transactionId: string, status?: string): void {
    const sentryBackend = this.backends.get("sentry");
    if (sentryBackend && this.isPerformanceBackend(sentryBackend)) {
      sentryBackend.finishTransaction(transactionId, status);
    }
  }

  // === TYPE SAFETY HELPER METHODS ===

  /**
   * Type guard to check if a backend supports performance monitoring
   */
  private isPerformanceBackend(
    backend: LoggingBackend,
  ): backend is PerformanceLoggingBackend {
    return "startTransaction" in backend && "finishTransaction" in backend;
  }

  // === BATCH PROCESSING HELPER METHODS ===

  /**
   * Determine if batch processing should be used based on current load
   */
  private shouldUseBatchProcessing(): boolean {
    // Use batch processing if we have multiple backends or if there are already pending entries
    return this.backends.size > 1 || this.pendingEntries.length > 0;
  }

  /**
   * Schedule a batch flush if not already scheduled
   */
  private scheduleBatchFlush(): void {
    if (!this.batchFlushTimer) {
      this.batchFlushTimer = setTimeout(async () => {
        await this.flushPendingEntries();
      }, this.BATCH_FLUSH_INTERVAL);
    }
  }

  /**
   * Flush all pending log entries using batch processing
   */
  private async flushPendingEntries(): Promise<void> {
    if (this.pendingEntries.length === 0) {
      return;
    }

    // Clear the timer
    if (this.batchFlushTimer) {
      clearTimeout(this.batchFlushTimer);
      this.batchFlushTimer = undefined;
    }

    // Get entries to flush and clear pending array
    const entriesToFlush = [...this.pendingEntries];
    this.pendingEntries = [];

    // Send to all backends using batch processing
    const promises = [...this.backends.values()].map(async (backend) => {
      try {
        // Use logBatch if available and beneficial, otherwise fall back to individual logs
        await (entriesToFlush.length > 1
          ? backend.logBatch(entriesToFlush)
          : backend.log(entriesToFlush[0]));
      } catch (error) {
        console.error(`Failed to batch log to backend ${backend.name}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }
}

/**
 * Scoped logger with specific context
 */
export class ScopedLogger {
  constructor(
    private manager: LoggingManager,
    private context: LoggingContext,
  ) {}

  async debug(message: string, data?: Record<string, unknown>): Promise<void> {
    await this.manager.debug(message, data, this.context);
  }

  async info(message: string, data?: Record<string, unknown>): Promise<void> {
    await this.manager.info(message, data, this.context);
  }

  async warning(
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    await this.manager.warning(message, data, this.context);
  }

  async error(
    message: string,
    error?: Error,
    data?: Record<string, unknown>,
  ): Promise<void> {
    await this.manager.error(message, error, data, this.context);
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: Partial<LoggingContext>): ScopedLogger {
    return new ScopedLogger(this.manager, {
      ...this.context,
      ...additionalContext,
    });
  }
}
