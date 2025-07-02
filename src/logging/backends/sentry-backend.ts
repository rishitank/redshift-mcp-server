/**
 * Sentry Logging Backend
 *
 * Sends error logs and performance metrics to Sentry for monitoring and alerting
 */

import { LoggingLevel } from "@modelcontextprotocol/sdk/types";
import { PACKAGE_NAME } from "../../constants";
import {
  LogEntry,
  SentryConfig,
  LoggingBackendConfig,
  PerformanceLoggingBackend,
} from "../interfaces";
import { BaseLoggingBackend } from "../base-backend";

// Dynamic import interface for Sentry
interface SentrySDK {
  init: (options: Record<string, unknown>) => void;
  captureException: (
    exception: Error,
    context?: Record<string, unknown>,
  ) => string;
  captureMessage: (
    message: string,
    level?: string,
    context?: Record<string, unknown>,
  ) => string;
  addBreadcrumb: (breadcrumb: Record<string, unknown>) => void;
  setTag: (key: string, value: string) => void;
  setExtra: (key: string, value: unknown) => void;
  setUser: (user: Record<string, unknown>) => void;
  setContext: (name: string, context: Record<string, unknown>) => void;
  startTransaction: (context: Record<string, unknown>) => SentryTransaction;
  getCurrentHub: () => SentryHub;
  withScope: (callback: (scope: SentryScope) => void) => void;
  flush: (timeout?: number) => Promise<boolean>;
  close: (timeout?: number) => Promise<boolean>;
}

// Sentry-specific interfaces for type safety
interface SentryScope {
  setUser: (user: Record<string, unknown>) => void;
  setContext: (name: string, context: Record<string, unknown>) => void;
  setTag: (key: string, value: string) => void;
  startChild: (spanContext: Record<string, unknown>) => SentrySpan;
}

interface SentryTransaction {
  setStatus: (status: string) => void;
  finish: () => void;
}

interface SentrySpan {
  setTimestamp: (timestamp: number) => void;
  finish: () => void;
}

interface SentryHub {
  // Hub interface methods if needed
}

interface SentryEvent {
  extra?: {
    data?: Record<string, unknown>;
  };
}

/**
 * Sentry logging backend for error tracking and performance monitoring
 */
export class SentryLoggingBackend
  extends BaseLoggingBackend
  implements PerformanceLoggingBackend
{
  readonly name = "sentry";
  private sentry?: SentrySDK;
  private activeTransactions = new Map<string, SentryTransaction>();

  protected async doInitialize(config: LoggingBackendConfig): Promise<void> {
    const sentryConfig = config as SentryConfig;

    // Validate Sentry-specific configuration
    if (!sentryConfig.dsn) {
      throw new Error("Sentry backend requires dsn configuration");
    }

    try {
      // Dynamic import of Sentry SDK
      this.sentry = await import("@sentry/node");

      // Initialize Sentry
      this.sentry.init({
        dsn: sentryConfig.dsn,
        environment:
          sentryConfig.environment || process.env.NODE_ENV || "production",
        release: sentryConfig.release || process.env.npm_package_version,
        serverName: sentryConfig.serverName || process.env.HOSTNAME,
        sampleRate: sentryConfig.sampleRate || 1,
        tracesSampleRate: sentryConfig.tracesSampleRate || 0.1,
        profilesSampleRate: sentryConfig.profilesSampleRate || 0.1,
        debug: sentryConfig.debug || false,
        integrations: this.getIntegrations(sentryConfig),
        beforeSend: this.createBeforeSendFilter(sentryConfig),
        initialScope: {
          tags: {
            service: PACKAGE_NAME,
            component: "logging",
            ...sentryConfig.tags,
          },
          extra: sentryConfig.extra,
        },
      });

      // Set global tags
      if (sentryConfig.tags) {
        for (const [key, value] of Object.entries(sentryConfig.tags)) {
          this.sentry!.setTag(key, value);
        }
      }
    } catch (error) {
      throw error;
    }
  }

  protected async doLog(entry: LogEntry): Promise<void> {
    if (!this.sentry) {
      return;
    }

    const sentryConfig = this.config as SentryConfig;

    try {
      // Add breadcrumb for all log entries
      this.sentry.addBreadcrumb({
        message: entry.message,
        level: this.mapLogLevelToSentry(entry.level),
        timestamp: new Date(entry.timestamp).getTime() / 1000,
        category: entry.component || "general",
        data: {
          correlationId: entry.correlationId,
          queryId: entry.queryId,
          duration: entry.duration,
          ...entry.data,
        },
      });

      // Handle different log levels
      if (
        entry.level === "error" ||
        entry.level === "critical" ||
        entry.level === "alert" ||
        entry.level === "emergency"
      ) {
        if (entry.error) {
          // Capture exception with context
          this.sentry.withScope((scope: SentryScope) => {
            this.setContextFromEntry(scope, entry);
            this.sentry!.captureException(new Error(entry.error!.message), {
              tags: {
                component: entry.component,
                event: entry.event,
              },
              extra: {
                originalError: entry.error,
                logEntry: entry,
              },
            });
          });
        } else {
          // Capture message for errors without exception objects
          this.sentry.withScope((scope: SentryScope) => {
            this.setContextFromEntry(scope, entry);
            this.sentry!.captureMessage(entry.message, "error", {
              tags: {
                component: entry.component,
                event: entry.event,
              },
              extra: entry.data,
            });
          });
        }
      }

      // Handle performance monitoring
      if (
        sentryConfig.enablePerformanceMonitoring &&
        entry.duration &&
        entry.queryId
      ) {
        this.handlePerformanceMetric(entry);
      }
    } catch (error) {
      this.handleError("sentryLog", error as Error);
    }
  }

  async flush(): Promise<void> {
    if (this.sentry) {
      await this.sentry.flush(5000); // 5 second timeout
    }
  }

  protected async doClose(): Promise<void> {
    if (this.sentry) {
      await this.sentry.close(2000); // 2 second timeout
    }
  }

  protected doHealthCheck(): boolean {
    return this.sentry !== undefined;
  }

  /**
   * Start a performance transaction
   */
  startTransaction(
    name: string,
    operation: string,
    correlationId?: string,
  ): string {
    const sentryConfig = this.config as SentryConfig;

    if (!this.sentry || !sentryConfig?.enablePerformanceMonitoring) {
      return "";
    }

    const transactionId = correlationId || `${name}-${Date.now()}`;

    try {
      const transaction = this.sentry.startTransaction({
        name,
        op: operation,
        tags: {
          service: PACKAGE_NAME,
          component: "database",
        },
      });

      this.activeTransactions.set(transactionId, transaction);
      return transactionId;
    } catch (error) {
      console.error("Failed to start Sentry transaction:", error);
      return "";
    }
  }

  /**
   * Finish a performance transaction
   */
  finishTransaction(transactionId: string, status?: string): void {
    if (!this.sentry || !transactionId) {
      return;
    }

    const transaction = this.activeTransactions.get(transactionId);
    if (transaction) {
      if (status) {
        transaction.setStatus(status);
      }
      transaction.finish();
      this.activeTransactions.delete(transactionId);
    }
  }

  private handlePerformanceMetric(entry: LogEntry): void {
    if (!entry.queryId || !entry.duration) {
      return;
    }

    // Create a span for the database operation
    this.sentry!.withScope((scope: SentryScope) => {
      const span = scope.startChild({
        op: "db.query",
        description: entry.message,
        data: {
          "db.system": "redshift",
          "db.operation": entry.event || "query",
          "db.statement": entry.data?.sql || "unknown",
          "query.duration": entry.duration,
          "query.id": entry.queryId,
        },
      });

      // Set span duration
      span.setTimestamp(Date.now() / 1000 - entry.duration / 1000);
      span.finish();
    });
  }

  private setContextFromEntry(scope: SentryScope, entry: LogEntry): void {
    // Set user context
    if (entry.userId) {
      scope.setUser({ id: entry.userId });
    }

    // Set request context
    if (entry.correlationId || entry.sessionId) {
      scope.setContext("request", {
        correlation_id: entry.correlationId,
        session_id: entry.sessionId,
        query_id: entry.queryId,
      });
    }

    // Set database context
    if (entry.component === "database" || entry.component === "spectrum") {
      scope.setContext("database", {
        component: entry.component,
        event: entry.event,
        duration: entry.duration,
        ...entry.data,
      });
    }

    // Set tags
    if (entry.component) scope.setTag("component", entry.component);
    if (entry.event) scope.setTag("event", entry.event);
    if (entry.correlationId)
      scope.setTag("correlation_id", entry.correlationId);
  }

  private mapLogLevelToSentry(level: LoggingLevel): string {
    const mapping: Record<LoggingLevel, string> = {
      debug: "debug",
      info: "info",
      notice: "info",
      warning: "warning",
      error: "error",
      critical: "fatal",
      alert: "fatal",
      emergency: "fatal",
    };
    return mapping[level] || "info";
  }

  private getIntegrations(config: SentryConfig): string[] {
    // Default integrations for Node.js
    const integrations: string[] = [];

    if (config.enablePerformanceMonitoring) {
      // Add performance monitoring integrations
      integrations.push("Http", "OnUncaughtException", "OnUnhandledRejection");
    }

    return integrations;
  }

  private createBeforeSendFilter(
    config: SentryConfig,
  ): ((event: SentryEvent) => SentryEvent | null) | undefined {
    if (!config.beforeSend) {
      return undefined;
    }

    // This would be a custom filter function
    // For now, return a basic filter that removes sensitive data
    return (event: SentryEvent) => {
      // Remove sensitive data from logs
      if (event.extra?.data) {
        const sensitiveKeys = ["password", "token", "key", "secret"];
        for (const key of sensitiveKeys) {
          if (event.extra.data[key]) {
            event.extra.data[key] = "[REDACTED]";
          }
        }
      }
      return event;
    };
  }
}
