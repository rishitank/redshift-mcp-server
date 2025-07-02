/**
 * HTTP Logging Backend
 *
 * Sends log messages to HTTP endpoints (webhooks, log aggregators, etc.)
 */

import { PACKAGE_NAME } from "../../constants";
import {
  LogEntry,
  HttpLoggingConfig,
  LoggingBackendConfig,
} from "../interfaces";
import { BaseLoggingBackend } from "../base-backend";

/**
 * HTTP logging backend for sending logs to HTTP endpoints
 */
export class HttpLoggingBackend extends BaseLoggingBackend {
  readonly name = "http";
  private pendingLogs: LogEntry[] = [];

  protected async doInitialize(config: LoggingBackendConfig): Promise<void> {
    const httpConfig = config as HttpLoggingConfig;

    // Validate HTTP-specific configuration
    if (!httpConfig.url) {
      throw new Error("HTTP backend requires url configuration");
    }

    // Start periodic flush if batch size is configured
    if (httpConfig.flushInterval && httpConfig.flushInterval > 0) {
      const flushTimer = setInterval(() => {
        this.flush().catch((error) =>
          this.handleError("periodicFlush", error as Error),
        );
      }, httpConfig.flushInterval);

      // Register timer for cleanup
      this.registerTimer(flushTimer);
    }
  }

  protected async doLog(entry: LogEntry): Promise<void> {
    const httpConfig = this.config as HttpLoggingConfig;

    if (httpConfig.batchSize && httpConfig.batchSize > 1) {
      // Add to batch
      this.pendingLogs.push(entry);

      // Flush if batch is full
      if (this.pendingLogs.length >= httpConfig.batchSize) {
        await this.flush();
      }
    } else {
      // Send immediately
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
    const httpConfig = this.config as HttpLoggingConfig;

    if (!httpConfig?.url) {
      return false;
    }

    try {
      // Simple health check - try to reach the endpoint
      const response = await fetch(httpConfig.url, {
        method: "HEAD",
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(httpConfig.timeout || 5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async sendLogs(entries: LogEntry[]): Promise<void> {
    const httpConfig = this.config as HttpLoggingConfig;

    if (!httpConfig || entries.length === 0) {
      return;
    }

    const payload = this.formatPayload(entries);
    const headers = this.getHeaders();

    let retryCount = 0;
    const maxRetries = httpConfig.retryAttempts || 3;

    while (retryCount <= maxRetries) {
      try {
        const response = await fetch(httpConfig.url, {
          method: httpConfig.method || "POST",
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(httpConfig.timeout || 10_000),
        });

        if (response.ok) {
          return;
        }

        if (response.status >= 400 && response.status < 500) {
          // Client error, don't retry
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Server error, retry
        retryCount++;
        if (retryCount <= maxRetries) {
          await this.delay(Math.pow(2, retryCount) * 1000); // Exponential backoff
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

  private formatPayload(entries: LogEntry[]): unknown {
    const httpConfig = this.config as HttpLoggingConfig;

    if (!httpConfig) {
      return entries;
    }

    switch (httpConfig.format) {
      case "logfmt": {
        return entries.map((entry) => this.toLogfmt(entry)).join("\n");
      }

      case "custom": {
        if (httpConfig.customFormatter) {
          return entries.map((entry) => httpConfig.customFormatter!(entry));
        }
        return entries;
      }

      case "json":
      default: {
        return entries.length === 1 ? entries[0] : entries;
      }
    }
  }

  private toLogfmt(entry: LogEntry): string {
    const pairs: string[] = [
      `level=${entry.level}`,
      `timestamp="${entry.timestamp}"`,
      `message="${entry.message}"`,
    ];

    if (entry.component) pairs.push(`component=${entry.component}`);
    if (entry.event) pairs.push(`event=${entry.event}`);
    if (entry.correlationId)
      pairs.push(`correlation_id=${entry.correlationId}`);
    if (entry.duration) pairs.push(`duration=${entry.duration}`);

    return pairs.join(" ");
  }

  private getHeaders(): Record<string, string> {
    const httpConfig = this.config as HttpLoggingConfig;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": `${PACKAGE_NAME}/1.0`,
    };

    if (httpConfig?.headers) {
      Object.assign(headers, httpConfig.headers);
    }

    if (httpConfig?.apiKey) {
      headers["Authorization"] = `Bearer ${httpConfig.apiKey}`;
    }

    return headers;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
