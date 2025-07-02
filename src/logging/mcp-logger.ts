/**
 * MCP Logger Module for Redshift MCP Server
 *
 * This module provides structured logging capabilities that send log messages
 * to MCP clients via notifications, enabling real-time monitoring and debugging.
 */

import { Server } from "@modelcontextprotocol/sdk/server";
import { logger } from "./global-logger";

/**
 * Log levels supported by MCP
 */
export enum MCPLogLevel {
  DEBUG = "debug",
  INFO = "info",
  NOTICE = "notice",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
  ALERT = "alert",
  EMERGENCY = "emergency",
}

/**
 * MCP Logger class for sending structured log messages to clients
 */
export class MCPLogger {
  private server: Server;
  private enabled: boolean;

  constructor(server: Server) {
    this.server = server;
    this.enabled = true;
  }

  /**
   * Send a debug log message to MCP clients
   */
  async debug(message: string, data?: Record<string, unknown>): Promise<void> {
    // Winston handles debug level filtering automatically
    await this.log(MCPLogLevel.DEBUG, message, data);
  }

  /**
   * Send an info log message to MCP clients
   */
  async info(message: string, data?: Record<string, unknown>): Promise<void> {
    await this.log(MCPLogLevel.INFO, message, data);
  }

  /**
   * Send a notice log message to MCP clients
   */
  async notice(message: string, data?: Record<string, unknown>): Promise<void> {
    await this.log(MCPLogLevel.NOTICE, message, data);
  }

  /**
   * Send a warning log message to MCP clients
   */
  async warning(
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    await this.log(MCPLogLevel.WARNING, message, data);
  }

  /**
   * Send an error log message to MCP clients
   */
  async error(message: string, data?: Record<string, unknown>): Promise<void> {
    await this.log(MCPLogLevel.ERROR, message, data);
  }

  /**
   * Send a critical log message to MCP clients
   */
  async critical(
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    await this.log(MCPLogLevel.CRITICAL, message, data);
  }

  /**
   * Log Spectrum-specific events with appropriate level
   */
  async logSpectrum(
    event: "detection" | "transaction" | "error",
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const level = event === "error" ? MCPLogLevel.ERROR : MCPLogLevel.INFO;
    const spectrumMessage = `[Spectrum] ${message}`;

    await this.log(level, spectrumMessage, {
      ...data,
      component: "spectrum",
      event,
    });
  }

  /**
   * Log database operation events
   */
  async logDatabase(
    operation: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    await this.log(MCPLogLevel.INFO, `[Database] ${operation}: ${message}`, {
      ...data,
      component: "database",
      operation,
    });
  }

  /**
   * Log security events
   */
  async logSecurity(
    event: "validation" | "sanitization" | "violation",
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const level =
      event === "violation" ? MCPLogLevel.WARNING : MCPLogLevel.INFO;

    await this.log(level, `[Security] ${message}`, {
      ...data,
      component: "security",
      event,
    });
  }

  /**
   * Send a structured log message to MCP clients
   */
  private async log(
    level: MCPLogLevel,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      // Send logging notification to MCP clients
      await this.server.notification({
        method: "notifications/message",
        params: {
          level,
          logger: "redshift-mcp-server",
          data: {
            message,
            timestamp: new Date().toISOString(),
            ...data,
          },
        },
      });
    } catch (error) {
      // Fallback to Winston logger if MCP notification fails
      logger.error(
        "Failed to send MCP log notification",
        error instanceof Error ? error : undefined,
        {
          component: "mcp-logger",
          originalLevel: level,
          originalMessage: message,
          originalData: data,
        },
      );
    }
  }

  /**
   * Enable or disable MCP logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if MCP logging is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * Global MCP logger instance (will be initialized when server starts)
 */
let mcpLogger: MCPLogger | null = null;

/**
 * Initialize the global MCP logger
 */
export function initializeMCPLogger(server: Server): MCPLogger {
  mcpLogger = new MCPLogger(server);
  return mcpLogger;
}

/**
 * Get the global MCP logger instance
 */
export function getMCPLogger(): MCPLogger {
  if (!mcpLogger) {
    throw new Error(
      "MCP Logger not initialized. Call initializeMCPLogger first.",
    );
  }
  return mcpLogger;
}

/**
 * Convenience functions for global logging
 */
export const mcpLog = {
  debug: async (message: string, data?: Record<string, unknown>) => {
    if (mcpLogger) await mcpLogger.debug(message, data);
  },
  info: async (message: string, data?: Record<string, unknown>) => {
    if (mcpLogger) await mcpLogger.info(message, data);
  },
  warning: async (message: string, data?: Record<string, unknown>) => {
    if (mcpLogger) await mcpLogger.warning(message, data);
  },
  error: async (message: string, data?: Record<string, unknown>) => {
    if (mcpLogger) await mcpLogger.error(message, data);
  },
  spectrum: async (
    event: "detection" | "transaction" | "error",
    message: string,
    data?: Record<string, unknown>,
  ) => {
    if (mcpLogger) await mcpLogger.logSpectrum(event, message, data);
  },
  database: async (
    operation: string,
    message: string,
    data?: Record<string, unknown>,
  ) => {
    if (mcpLogger) await mcpLogger.logDatabase(operation, message, data);
  },
  security: async (
    event: "validation" | "sanitization" | "violation",
    message: string,
    data?: Record<string, unknown>,
  ) => {
    if (mcpLogger) await mcpLogger.logSecurity(event, message, data);
  },
};
