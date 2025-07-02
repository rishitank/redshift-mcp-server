/**
 * Base Logging Backend Class
 *
 * Abstract base class that provides common functionality for all logging backends.
 * Eliminates duplication of initialization, error handling, and lifecycle management patterns.
 */

import { LoggingBackend, LoggingBackendConfig, LogEntry } from "./interfaces";

/**
 * Abstract base class for logging backends that provides common functionality
 * and eliminates code duplication across concrete backend implementations.
 */
export abstract class BaseLoggingBackend implements LoggingBackend {
  // === ABSTRACT PROPERTIES (must be implemented by subclasses) ===
  abstract readonly name: string;

  // === COMMON PROPERTIES ===
  protected config?: LoggingBackendConfig;
  protected isInitialized = false;
  protected timers: Set<ReturnType<typeof setTimeout>> = new Set();

  // === ABSTRACT METHODS (must be implemented by subclasses) ===

  /**
   * Backend-specific initialization logic
   * Called after common validation and config storage
   */
  protected abstract doInitialize(
    config: LoggingBackendConfig,
  ): Promise<void> | void;

  /**
   * Backend-specific log implementation
   * Called after common validation
   */
  protected abstract doLog(entry: LogEntry): Promise<void> | void;

  /**
   * Backend-specific cleanup logic
   * Called before common cleanup in close()
   */
  protected abstract doClose(): Promise<void> | void;

  /**
   * Backend-specific health check logic
   */
  protected abstract doHealthCheck(): Promise<boolean> | boolean;

  // === COMMON IMPLEMENTATION (shared across all backends) ===

  /**
   * Initialize the backend with configuration
   * Provides common validation and delegates to doInitialize()
   */
  async initialize(config: LoggingBackendConfig): Promise<void> {
    try {
      // === COMMON VALIDATION ===
      this.validateConfig(config);

      // === COMMON CONFIG STORAGE ===
      this.config = config;

      // === BACKEND-SPECIFIC INITIALIZATION ===
      await this.doInitialize(config);

      this.isInitialized = true;

      // === COMMON SUCCESS LOGGING ===
      this.logInitializationSuccess();
    } catch (error) {
      // === COMMON ERROR HANDLING ===
      this.handleInitializationError(error as Error);
      throw error;
    }
  }

  /**
   * Log a single entry with common validation
   */
  async log(entry: LogEntry): Promise<void> {
    try {
      // === COMMON VALIDATION ===
      this.ensureInitialized();
      this.validateLogEntry(entry);

      // === BACKEND-SPECIFIC LOGGING ===
      await this.doLog(entry);
    } catch (error) {
      // === COMMON ERROR HANDLING ===
      this.handleLogError("log", error as Error, entry);
    }
  }

  /**
   * Log multiple entries (default implementation using individual logs)
   * Backends can override for true batch processing
   */
  async logBatch(entries: LogEntry[]): Promise<void> {
    try {
      this.ensureInitialized();

      // === COMMON BATCH VALIDATION ===
      if (!Array.isArray(entries) || entries.length === 0) {
        return;
      }

      // === DEFAULT BATCH IMPLEMENTATION ===
      // Most backends can use this simple implementation
      // Complex backends can override for true batch processing
      for (const entry of entries) {
        await this.doLog(entry);
      }
    } catch (error) {
      this.handleLogError("logBatch", error as Error);
    }
  }

  /**
   * Flush pending logs (default: no-op)
   * Backends with buffering should override
   */
  async flush(): Promise<void> {
    // Default implementation: no buffering, nothing to flush
    // Backends with buffering should override this method
  }

  /**
   * Close the backend with common cleanup
   */
  async close(): Promise<void> {
    try {
      // === COMMON TIMER CLEANUP ===
      this.clearAllTimers();

      // === BACKEND-SPECIFIC CLEANUP ===
      await this.doClose();

      // === COMMON STATE RESET ===
      this.isInitialized = false;
      this.config = undefined;
    } catch (error) {
      this.handleError("close", error as Error);
    }
  }

  /**
   * Check backend health with common error handling
   */
  async isHealthy(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        return false;
      }

      return await this.doHealthCheck();
    } catch (error) {
      this.handleError("healthCheck", error as Error);
      return false;
    }
  }

  // === COMMON UTILITY METHODS ===

  /**
   * Validate backend configuration
   */
  protected validateConfig(config: LoggingBackendConfig): void {
    if (!config || typeof config !== "object") {
      throw new Error(
        `Invalid configuration for ${this.name} backend: config must be an object`,
      );
    }

    // Validate common properties
    if (config.batchSize !== undefined) {
      if (
        typeof config.batchSize !== "number" ||
        config.batchSize < 1 ||
        config.batchSize > 10000
      ) {
        throw new Error(
          `Invalid batchSize for ${this.name} backend: must be a number between 1 and 10000`,
        );
      }
    }

    if (config.flushInterval !== undefined) {
      if (
        typeof config.flushInterval !== "number" ||
        config.flushInterval < 0
      ) {
        throw new Error(
          `Invalid flushInterval for ${this.name} backend: must be a non-negative number`,
        );
      }
    }

    if (config.enabled !== undefined && typeof config.enabled !== "boolean") {
      throw new Error(
        `Invalid enabled flag for ${this.name} backend: must be a boolean`,
      );
    }
  }

  /**
   * Validate log entry
   */
  protected validateLogEntry(entry: LogEntry): void {
    if (!entry || typeof entry !== "object") {
      throw new Error("Invalid log entry: must be an object");
    }

    if (!entry.message || typeof entry.message !== "string") {
      throw new Error(
        "Invalid log entry: message is required and must be a string",
      );
    }

    if (!entry.level || typeof entry.level !== "string") {
      throw new Error(
        "Invalid log entry: level is required and must be a string",
      );
    }

    if (!entry.timestamp || typeof entry.timestamp !== "string") {
      throw new Error(
        "Invalid log entry: timestamp is required and must be a string",
      );
    }
  }

  /**
   * Ensure backend is initialized
   */
  protected ensureInitialized(): void {
    if (!this.isInitialized || !this.config) {
      throw new Error(`${this.name} backend not initialized`);
    }
  }

  /**
   * Register a timer for cleanup
   */
  protected registerTimer(timer: ReturnType<typeof setTimeout>): void {
    this.timers.add(timer);
  }

  /**
   * Clear a specific timer
   */
  protected clearTimer(timer: ReturnType<typeof setTimeout>): void {
    clearTimeout(timer);
    this.timers.delete(timer);
  }

  /**
   * Clear all registered timers
   */
  protected clearAllTimers(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  /**
   * Common error handling
   */
  protected handleError(operation: string, error: Error): void {
    console.error(`[${this.name}] Error in ${operation}:`, error.message);
  }

  /**
   * Handle initialization errors
   */
  protected handleInitializationError(error: Error): void {
    console.error(
      `❌ Failed to initialize ${this.name} backend:`,
      error.message,
    );
  }

  /**
   * Handle log operation errors
   */
  protected handleLogError(
    operation: string,
    error: Error,
    entry?: LogEntry,
  ): void {
    console.error(`[${this.name}] Failed to ${operation}:`, error.message);
    if (entry) {
      console.error(`[${this.name}] Failed entry:`, {
        level: entry.level,
        message: entry.message,
      });
    }
  }

  /**
   * Log successful initialization
   */
  protected logInitializationSuccess(): void {
    console.log(`✅ ${this.name} logging backend initialized successfully`);
  }

  /**
   * Get configuration value with default
   */
  protected getConfigValue<T>(
    key: keyof LoggingBackendConfig,
    defaultValue: T,
  ): T {
    return (this.config?.[key] as T) ?? defaultValue;
  }

  /**
   * Check if backend is enabled
   */
  protected isEnabled(): boolean {
    return this.getConfigValue("enabled", true);
  }
}
