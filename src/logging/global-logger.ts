/**
 * Global Winston Logger Utility
 *
 * Provides a global Winston logger instance that can be imported throughout the codebase
 * to replace console.log usage. Handles initialization and provides consistent logging interface.
 */

import { WinstonLoggingManager } from "./winston-manager";
import { loadWinstonLoggingConfig } from "./config-loader";
import { DatabaseLoggingManager } from "./interfaces";

/**
 * Global logger instance
 */
let globalLogger: DatabaseLoggingManager | null = null;

/**
 * Initialize global logger with Winston configuration
 */
export const initializeGlobalLogger = async (): Promise<void> => {
  if (globalLogger) {
    return; // Already initialized
  }

  try {
    const config = loadWinstonLoggingConfig();
    globalLogger = new WinstonLoggingManager(config);
    await globalLogger.initialize();
  } catch (error) {
    console.error("Failed to initialize global logger:", error);
    // Create fallback logger that uses console
    globalLogger = createFallbackLogger();
  }
};

/**
 * Get global logger instance (initializes if needed)
 */
export const getGlobalLogger = (): DatabaseLoggingManager => {
  if (!globalLogger) {
    // Create fallback logger for immediate use
    globalLogger = createFallbackLogger();

    // Initialize proper logger asynchronously
    initializeGlobalLogger().catch((error) => {
      console.error("Async global logger initialization failed:", error);
    });
  }

  return globalLogger;
};

/**
 * Set global logger instance (used for testing or custom initialization)
 */
export const setGlobalLogger = (logger: DatabaseLoggingManager): void => {
  globalLogger = logger;
};

/**
 * Create fallback logger that uses console for immediate availability
 */
const createFallbackLogger = (): DatabaseLoggingManager => ({
  async initialize(): Promise<void> {
    // No initialization needed for fallback
  },

  async debug(message: string, data?: Record<string, unknown>): Promise<void> {
    console.debug(`[DEBUG] ${message}`, data || "");
  },

  async info(message: string, data?: Record<string, unknown>): Promise<void> {
    console.info(`[INFO] ${message}`, data || "");
  },

  async warning(
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    console.warn(`[WARN] ${message}`, data || "");
  },

  async error(
    message: string,
    error?: Error,
    data?: Record<string, unknown>,
  ): Promise<void> {
    if (error) {
      console.error(`[ERROR] ${message}`, error, data || "");
    } else {
      console.error(`[ERROR] ${message}`, data || "");
    }
  },

  setGlobalContext(): void {
    // No-op for fallback
  },

  createScopedLogger(): any {
    return this; // Return self for fallback
  },

  startTransaction(): string {
    return "fallback-transaction";
  },

  finishTransaction(): void {
    // No-op for fallback
  },

  async getHealthStatus(): Promise<Record<string, boolean>> {
    return { fallback: true };
  },

  async flush(): Promise<void> {
    // No-op for fallback
  },

  async close(): Promise<void> {
    globalLogger = null;
  },
});

/**
 * Convenience functions for direct logging (replaces console.log usage)
 */
export const logger = {
  debug: (message: string, data?: Record<string, unknown>) => {
    getGlobalLogger().debug(message, data);
  },

  info: (message: string, data?: Record<string, unknown>) => {
    getGlobalLogger().info(message, data);
  },

  warn: (message: string, data?: Record<string, unknown>) => {
    getGlobalLogger().warning(message, data);
  },

  warning: (message: string, data?: Record<string, unknown>) => {
    getGlobalLogger().warning(message, data);
  },

  error: (
    message: string,
    error?: Error | Record<string, unknown>,
    data?: Record<string, unknown>,
  ) => {
    if (error instanceof Error) {
      getGlobalLogger().error(message, error, data);
    } else {
      getGlobalLogger().error(message, undefined, error);
    }
  },
};

/**
 * Export default logger for convenience
 */
export default logger;
