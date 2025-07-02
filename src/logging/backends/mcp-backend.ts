/**
 * MCP Logging Backend
 *
 * Sends log messages to MCP clients via notifications
 */

import { Server } from "@modelcontextprotocol/sdk/server";
import { PACKAGE_NAME } from "../../constants";
import { LoggingBackendConfig, LogEntry } from "../interfaces";
import { BaseLoggingBackend } from "../base-backend";

/**
 * MCP logging backend that sends logs to MCP clients
 */
export class MCPLoggingBackend extends BaseLoggingBackend {
  readonly name = "mcp";
  private server?: Server;

  protected doInitialize(config: LoggingBackendConfig): void {
    // Server will be set externally via setServer method
    // No additional initialization required
  }

  /**
   * Set the MCP server instance
   */
  setServer(server: Server): void {
    this.server = server;
  }

  protected async doLog(entry: LogEntry): Promise<void> {
    if (!this.server) {
      // Fallback to console if MCP server not available
      console.log(
        `[${entry.level.toUpperCase()}] ${entry.message}`,
        entry.data,
      );
      return;
    }

    try {
      await this.server.notification({
        method: "notifications/message",
        params: {
          level: entry.level,
          logger: PACKAGE_NAME,
          data: {
            message: entry.message,
            timestamp: entry.timestamp,
            component: entry.component,
            event: entry.event,
            correlationId: entry.correlationId,
            userId: entry.userId,
            sessionId: entry.sessionId,
            queryId: entry.queryId,
            duration: entry.duration,
            error: entry.error,
            ...entry.data,
          },
        },
      });
    } catch (error) {
      // Fallback to console logging if MCP notification fails
      this.handleError("mcpNotification", error as Error);
      console.log(
        `[${entry.level.toUpperCase()}] ${entry.message}`,
        entry.data,
      );
    }
  }

  protected doClose(): void {
    // No cleanup needed for MCP backend
  }

  protected doHealthCheck(): boolean {
    return this.server !== undefined;
  }
}
