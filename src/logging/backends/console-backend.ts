/**
 * Console Logging Backend
 *
 * Outputs log messages to console with optional formatting and colors
 */

import { LoggingLevel } from "@modelcontextprotocol/sdk/types";
import {
  LogEntry,
  ConsoleLoggingConfig,
  LoggingBackendConfig,
} from "../interfaces";
import { BaseLoggingBackend } from "../base-backend";

/**
 * Console logging backend for development and debugging
 */
export class ConsoleLoggingBackend extends BaseLoggingBackend {
  readonly name = "console";

  protected doInitialize(config: LoggingBackendConfig): void {
    // Console backend has no special initialization requirements
    // Base class handles all common initialization
  }

  protected doLog(entry: LogEntry): void {
    const formatted = this.formatEntry(entry);

    // Use appropriate console method based on log level
    switch (entry.level) {
      case "error":
      case "critical":
      case "alert":
      case "emergency": {
        console.error(formatted);
        break;
      }
      case "warning": {
        console.warn(formatted);
        break;
      }
      case "debug": {
        console.debug(formatted);
        break;
      }
      default: {
        console.log(formatted);
      }
    }
  }

  protected doClose(): void {
    // No cleanup needed for console backend
  }

  protected doHealthCheck(): boolean {
    return true; // Console is always available
  }

  private formatEntry(entry: LogEntry): string {
    const consoleConfig = this.config as ConsoleLoggingConfig;

    if (consoleConfig?.format === "json") {
      return JSON.stringify(entry, null, 2);
    }

    // Pretty format
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = this.colorizeLevel(entry.level);
    const component = entry.component ? `[${entry.component}]` : "";
    const correlationId = entry.correlationId
      ? `(${entry.correlationId.slice(0, 8)})`
      : "";

    let message = `${timestamp} ${level} ${component}${correlationId} ${entry.message}`;

    if (entry.duration) {
      message += ` (${entry.duration}ms)`;
    }

    if (entry.error) {
      message += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        message += `\n  Stack: ${entry.error.stack}`;
      }
    }

    if (entry.data && Object.keys(entry.data).length > 0) {
      message += `\n  Data: ${JSON.stringify(entry.data, null, 2)}`;
    }

    return message;
  }

  private colorizeLevel(level: LoggingLevel): string {
    const consoleConfig = this.config as ConsoleLoggingConfig;

    if (!consoleConfig?.colorize) {
      return level.toUpperCase().padEnd(8);
    }

    const colors: Record<LoggingLevel, string> = {
      debug: "\u001B[36m", // Cyan
      info: "\u001B[32m", // Green
      notice: "\u001B[34m", // Blue
      warning: "\u001B[33m", // Yellow
      error: "\u001B[31m", // Red
      critical: "\u001B[35m", // Magenta
      alert: "\u001B[41m", // Red background
      emergency: "\u001B[41m\u001B[37m", // Red background, white text
    };

    const reset = "\u001B[0m";
    const color = colors[level] || "";

    return `${color}${level.toUpperCase().padEnd(8)}${reset}`;
  }
}
