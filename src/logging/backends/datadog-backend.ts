/**
 * Datadog Logging Backend
 *
 * Sends log messages to Datadog Logs API
 */

import { PACKAGE_NAME } from "../../constants";
import { LogEntry, DatadogConfig, LoggingBackendConfig } from "../interfaces";
import { BaseLoggingBackend } from "../base-backend";

/**
 * Datadog logging backend for enterprise monitoring
 */
export class DatadogLoggingBackend extends BaseLoggingBackend {
  readonly name = "datadog";
  private pendingLogs: LogEntry[] = [];

  protected async doInitialize(config: LoggingBackendConfig): Promise<void> {
    const datadogConfig = config as DatadogConfig;

    // Validate Datadog-specific configuration
    if (!datadogConfig.apiKey || !datadogConfig.service) {
      throw new Error(
        "Datadog backend requires apiKey and service configuration",
      );
    }

    // Start periodic flush
    if (datadogConfig.flushInterval && datadogConfig.flushInterval > 0) {
      const flushTimer = setInterval(() => {
        this.flush().catch((error) =>
          this.handleError("periodicFlush", error as Error),
        );
      }, datadogConfig.flushInterval);

      // Register timer for cleanup
      this.registerTimer(flushTimer);
    }
  }

  protected async doLog(entry: LogEntry): Promise<void> {
    const datadogConfig = this.config as DatadogConfig;

    if (datadogConfig.batchSize && datadogConfig.batchSize > 1) {
      this.pendingLogs.push(entry);

      if (this.pendingLogs.length >= datadogConfig.batchSize) {
        await this.flush();
      }
    } else {
      await this.sendLogs([entry]);
    }
  }

  async logBatch(entries: LogEntry[]): Promise<void> {
    // Override base implementation for true batch processing
    await this.sendLogs(entries);
  }

  async flush(): Promise<void> {
    if (this.pendingLogs.length === 0) {
      return;
    }

    const logsToSend = [...this.pendingLogs];
    this.pendingLogs = [];

    await this.sendLogs(logsToSend);
  }

  protected async doClose(): Promise<void> {
    // Flush any remaining logs before closing
    await this.flush();
  }

  protected async doHealthCheck(): Promise<boolean> {
    const datadogConfig = this.config as DatadogConfig;

    if (!datadogConfig?.apiKey) {
      return false;
    }

    try {
      const url = this.getLogsUrl();
      const response = await fetch(url, {
        method: "HEAD",
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async sendLogs(entries: LogEntry[]): Promise<void> {
    const datadogConfig = this.config as DatadogConfig;

    if (!datadogConfig || entries.length === 0) {
      return;
    }

    const payload = entries.map((entry) => this.formatForDatadog(entry));
    const url = this.getLogsUrl();
    const headers = this.getHeaders();

    let retryCount = 0;
    const maxRetries = datadogConfig.retryAttempts || 3;

    while (retryCount <= maxRetries) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(datadogConfig.timeout || 10_000),
        });

        if (response.ok) {
          return;
        }

        if (response.status >= 400 && response.status < 500) {
          throw new Error(
            `Datadog API error ${response.status}: ${response.statusText}`,
          );
        }

        retryCount++;
        if (retryCount <= maxRetries) {
          await this.delay(Math.pow(2, retryCount) * 1000);
        }
      } catch (error) {
        retryCount++;
        if (retryCount > maxRetries) {
          throw error;
        }
        await this.delay(Math.pow(2, retryCount) * 1000);
      }
    }
  }

  private formatForDatadog(entry: LogEntry): Record<string, unknown> {
    const datadogConfig = this.config as DatadogConfig;

    const ddEntry: Record<string, unknown> = {
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
      service: datadogConfig.service,
      source: datadogConfig.source || PACKAGE_NAME,
      hostname: process.env.HOSTNAME || "unknown",
    };

    // Add tags
    if (datadogConfig.tags) {
      ddEntry.ddtags = datadogConfig.tags.join(",");
    }

    // Add custom attributes
    if (entry.component) ddEntry.component = entry.component;
    if (entry.event) ddEntry.event = entry.event;
    if (entry.correlationId) ddEntry.correlation_id = entry.correlationId;
    if (entry.userId) ddEntry.user_id = entry.userId;
    if (entry.sessionId) ddEntry.session_id = entry.sessionId;
    if (entry.queryId) ddEntry.query_id = entry.queryId;
    if (entry.duration) ddEntry.duration = entry.duration;

    // Add error details
    if (entry.error) {
      ddEntry["error.kind"] = entry.error.name;
      ddEntry["error.message"] = entry.error.message;
      if (entry.error.stack) {
        ddEntry["error.stack"] = entry.error.stack;
      }
    }

    // Add custom data
    if (entry.data) {
      for (const [key, value] of Object.entries(entry.data)) {
        ddEntry[key] = value;
      }
    }

    return ddEntry;
  }

  private getLogsUrl(): string {
    const datadogConfig = this.config as DatadogConfig;
    const site = datadogConfig.site || "datadoghq.com";
    return `https://http-intake.logs.${site}/v1/input/${datadogConfig.apiKey}`;
  }

  private getHeaders(): Record<string, string> {
    const datadogConfig = this.config as DatadogConfig;
    return {
      "Content-Type": "application/json",
      "DD-API-KEY": datadogConfig.apiKey,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
