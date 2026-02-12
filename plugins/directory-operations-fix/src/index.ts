/**
 * Directory Operations Fix Plugin Entry Point
 * Addresses Issue #9855: Claude code crashes when referencing directories
 */

import { Logger, LogLevel } from './logger';
import { DirectoryOperationHandler, detectModelCompatibility } from './directoryOperations';

export interface PluginConfig {
  retryAttempts?: number;
  retryDelay?: number;
  logLevel?: string;
}

export class DirectoryOperationsFixPlugin {
  private logger: Logger;
  private handler: DirectoryOperationHandler;
  private config: PluginConfig;

  constructor(config: PluginConfig = {}) {
    this.config = {
      retryAttempts: 3,
      retryDelay: 1000,
      logLevel: 'INFO',
      ...config
    };

    // Initialize logger
    const logLevel = LogLevel[this.config.logLevel as keyof typeof LogLevel] || LogLevel.INFO;
    this.logger = new Logger('DirectoryOpsFix', logLevel);

    // Initialize handler
    this.handler = new DirectoryOperationHandler(this.logger);
    this.handler.setRetryConfig(this.config.retryAttempts!, this.config.retryDelay!);

    this.logger.info('Directory Operations Fix plugin initialized', { config: this.config });
  }

  /**
   * Main plugin method - enhanced directory listing
   */
  async listDirectory(path: string, modelName?: string) {
    this.logger.info('Plugin directory listing requested', { path, model: modelName });

    try {
      const modelInfo = modelName ? detectModelCompatibility(modelName) : undefined;
      const result = await this.handler.processDirectoryListing(path, modelInfo);

      this.logger.info('Directory listing completed successfully', { path });
      return result;

    } catch (error) {
      this.logger.error('Plugin directory listing failed', { path, error: error.message });
      throw error;
    }
  }

  /**
   * Get diagnostic information
   */
  getDiagnostics() {
    return {
      recentLogs: this.logger.getRecentLogs(20),
      config: this.config,
      pluginVersion: '1.0.0'
    };
  }

  /**
   * Update plugin configuration
   */
  updateConfig(newConfig: Partial<PluginConfig>) {
    this.config = { ...this.config, ...newConfig };

    if (newConfig.logLevel) {
      const logLevel = LogLevel[newConfig.logLevel as keyof typeof LogLevel];
      if (logLevel !== undefined) {
        this.logger.setLogLevel(logLevel);
      }
    }

    if (newConfig.retryAttempts !== undefined || newConfig.retryDelay !== undefined) {
      this.handler.setRetryConfig(
        newConfig.retryAttempts || this.config.retryAttempts!,
        newConfig.retryDelay || this.config.retryDelay!
      );
    }

    this.logger.info('Plugin configuration updated', { newConfig });
  }
}

// Export for use as a plugin
export function createPlugin(config?: PluginConfig): DirectoryOperationsFixPlugin {
  return new DirectoryOperationsFixPlugin(config);
}

// Export all utilities
export { Logger, LogLevel } from './logger';
export { DirectoryOperationHandler, detectModelCompatibility } from './directoryOperations';
export type { DirectoryResponse, ModelCompatibility } from './directoryOperations';