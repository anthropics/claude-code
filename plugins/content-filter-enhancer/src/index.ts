/**
 * Content Filter Enhancer Plugin Entry Point
 * Addresses Issue #9908: Content filter blocking legitimate SMTP configuration
 */

import { Logger, LogLevel } from './logger';
import { EnhancedContentFilter, FilterContext, FilterResult, FilterConfig, CustomPattern } from './contentFilter';

export interface PluginConfig extends Partial<FilterConfig> {
  logLevel?: string;
  autoEnable?: boolean;
}

export class ContentFilterEnhancerPlugin {
  private logger: Logger;
  private filter: EnhancedContentFilter;
  private config: PluginConfig;
  private filterStats = {
    totalFiltered: 0,
    allowed: 0,
    blocked: 0,
    falsePositivesPrevented: 0
  };

  constructor(config: PluginConfig = {}) {
    this.config = {
      autoEnable: true,
      logLevel: 'INFO',
      enableDevOpsWhitelist: true,
      enableConfigFileWhitelist: true,
      enableUserFileWhitelist: true,
      strictMode: false,
      customPatterns: [],
      ...config
    };

    // Initialize logger
    const logLevel = LogLevel[this.config.logLevel as keyof typeof LogLevel] || LogLevel.INFO;
    this.logger = new Logger('ContentFilterPlugin', logLevel);

    // Initialize enhanced content filter
    this.filter = new EnhancedContentFilter(this.logger, this.config);

    this.logger.info('Content Filter Enhancer plugin initialized', {
      devOpsWhitelist: this.config.enableDevOpsWhitelist,
      configFileWhitelist: this.config.enableConfigFileWhitelist,
      userFileWhitelist: this.config.enableUserFileWhitelist
    });
  }

  /**
   * Main content filtering method
   */
  async filterContent(
    message: string,
    files: string[] = [],
    userIntent?: string
  ): Promise<FilterResult> {
    this.filterStats.totalFiltered++;

    try {
      const context: FilterContext = {
        message,
        files,
        userIntent
      };

      const result = await this.filter.filterContent(context);

      // Update statistics
      if (result.allowed) {
        this.filterStats.allowed++;
      } else {
        this.filterStats.blocked++;
      }

      // Track false positive prevention
      if (result.reason.includes('false positive') || result.reason.includes('DevOps workflow')) {
        this.filterStats.falsePositivesPrevented++;
      }

      this.logger.debug('Content filter result', {
        allowed: result.allowed,
        confidence: result.confidence,
        messageLength: message.length,
        fileCount: files.length
      });

      return result;

    } catch (error) {
      this.logger.error('Content filtering failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Quick check for DevOps/SMTP configuration context
   */
  isDevOpsContext(message: string, files: string[]): boolean {
    const context: FilterContext = { message, files };
    const workspaceContext = this.filter['analyzeWorkspaceContext'](files);

    return this.filter['isLegitimateDevOpsContext'](message, files) ||
           this.filter['isUserCreatedConfigurationContext'](message, workspaceContext);
  }

  /**
   * Check if content matches Google App Password format (Issue #9908 specific)
   */
  isGoogleAppPassword(content: string): boolean {
    const googleAppPasswordPattern = /[a-z]{4}\s[a-z]{4}\s[a-z]{4}\s[a-z]{4}/i;
    const hasGoogleContext = content.toLowerCase().includes('gmail') ||
                            content.toLowerCase().includes('google') ||
                            content.toLowerCase().includes('smtp');

    return googleAppPasswordPattern.test(content) && hasGoogleContext;
  }

  /**
   * Add custom whitelist pattern
   */
  addWhitelistPattern(name: string, pattern: string, context?: string[]): void {
    const customPattern: CustomPattern = {
      name,
      pattern,
      isWhitelist: true,
      context
    };

    this.filter.addCustomPattern(customPattern);
    this.logger.info('Added custom whitelist pattern', { name, context });
  }

  /**
   * Add custom blacklist pattern
   */
  addBlacklistPattern(name: string, pattern: string, context?: string[]): void {
    const customPattern: CustomPattern = {
      name,
      pattern,
      isWhitelist: false,
      context
    };

    this.filter.addCustomPattern(customPattern);
    this.logger.info('Added custom blacklist pattern', { name, context });
  }

  /**
   * Remove custom pattern
   */
  removeCustomPattern(patternName: string): boolean {
    const removed = this.filter.removeCustomPattern(patternName);
    if (removed) {
      this.logger.info('Removed custom pattern', { pattern: patternName });
    }
    return removed;
  }

  /**
   * Get filtering statistics
   */
  getStats() {
    const status = this.filter.getStatus();

    return {
      ...this.filterStats,
      accuracy: this.filterStats.totalFiltered > 0
        ? ((this.filterStats.allowed + this.filterStats.falsePositivesPrevented) / this.filterStats.totalFiltered * 100).toFixed(1)
        : '100.0',
      config: status.config,
      patterns: {
        whitelist: status.whitelistPatterns,
        devopsFiles: status.devopsFilePatterns,
        intentKeywords: status.intentKeywords,
        custom: status.customPatterns
      }
    };
  }

  /**
   * Test content against filters without applying
   */
  async testContent(message: string, files: string[] = []): Promise<{
    result: FilterResult;
    analysis: {
      hasDevOpsFiles: boolean;
      hasDevOpsIntent: boolean;
      isGoogleAppPassword: boolean;
      matchedPatterns: string[];
    }
  }> {
    const result = await this.filterContent(message, files);

    const analysis = {
      hasDevOpsFiles: files.some(f => f.includes('env') || f.includes('config') || f.includes('docker')),
      hasDevOpsIntent: this.isDevOpsContext(message, files),
      isGoogleAppPassword: this.isGoogleAppPassword(message),
      matchedPatterns: [] // Would be populated by pattern matching logic
    };

    return { result, analysis };
  }

  /**
   * Enable/disable DevOps whitelist
   */
  toggleDevOpsWhitelist(enabled: boolean): void {
    this.config.enableDevOpsWhitelist = enabled;
    this.filter.updateConfig({ enableDevOpsWhitelist: enabled });
    this.logger.info(`DevOps whitelist ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable/disable configuration file whitelist
   */
  toggleConfigFileWhitelist(enabled: boolean): void {
    this.config.enableConfigFileWhitelist = enabled;
    this.filter.updateConfig({ enableConfigFileWhitelist: enabled });
    this.logger.info(`Config file whitelist ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable/disable user file whitelist
   */
  toggleUserFileWhitelist(enabled: boolean): void {
    this.config.enableUserFileWhitelist = enabled;
    this.filter.updateConfig({ enableUserFileWhitelist: enabled });
    this.logger.info(`User file whitelist ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set strict mode (more conservative filtering)
   */
  setStrictMode(enabled: boolean): void {
    this.config.strictMode = enabled;
    this.filter.updateConfig({ strictMode: enabled });
    this.logger.info(`Strict mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get diagnostics information
   */
  getDiagnostics() {
    const stats = this.getStats();
    const loggerMemory = this.logger.getMemoryUsage();

    return {
      stats,
      loggerMemory,
      config: this.config,
      recentLogs: this.logger.getRecentLogs(10)
    };
  }

  /**
   * Update plugin configuration
   */
  updateConfig(newConfig: Partial<PluginConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (newConfig.logLevel) {
      const logLevel = LogLevel[newConfig.logLevel as keyof typeof LogLevel];
      if (logLevel !== undefined) {
        this.logger.setLogLevel(logLevel);
      }
    }

    // Update filter config (excluding plugin-specific options)
    const { logLevel, autoEnable, ...filterConfig } = newConfig;
    if (Object.keys(filterConfig).length > 0) {
      this.filter.updateConfig(filterConfig);
    }

    this.logger.info('Plugin configuration updated', { changedKeys: Object.keys(newConfig) });
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.filterStats = {
      totalFiltered: 0,
      allowed: 0,
      blocked: 0,
      falsePositivesPrevented: 0
    };
    this.logger.info('Filter statistics reset');
  }

  /**
   * Export configuration and patterns
   */
  exportConfig(): string {
    const exportData = {
      config: this.config,
      stats: this.filterStats,
      timestamp: new Date().toISOString()
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import configuration
   */
  importConfig(configJson: string): void {
    try {
      const importData = JSON.parse(configJson);
      if (importData.config) {
        this.updateConfig(importData.config);
        this.logger.info('Configuration imported successfully');
      }
    } catch (error) {
      this.logger.error('Failed to import configuration', { error: error.message });
      throw new Error(`Configuration import failed: ${error.message}`);
    }
  }
}

// Export factory function
export function createContentFilterPlugin(config?: PluginConfig): ContentFilterEnhancerPlugin {
  return new ContentFilterEnhancerPlugin(config);
}

// Export utilities
export { Logger, LogLevel } from './logger';
export { EnhancedContentFilter } from './contentFilter';
export type { FilterContext, FilterResult, FilterConfig, CustomPattern } from './contentFilter';

// Global instance for easy access
let globalInstance: ContentFilterEnhancerPlugin | null = null;

export function getGlobalContentFilter(): ContentFilterEnhancerPlugin | null {
  return globalInstance;
}

export function initializeGlobalContentFilter(config?: PluginConfig): ContentFilterEnhancerPlugin {
  globalInstance = new ContentFilterEnhancerPlugin(config);
  return globalInstance;
}

// Utility functions for quick checks
export function isLikelyDevOpsContent(message: string, files: string[] = []): boolean {
  const plugin = getGlobalContentFilter() || createContentFilterPlugin();
  return plugin.isDevOpsContext(message, files);
}

export function isGoogleAppPasswordFormat(content: string): boolean {
  const plugin = getGlobalContentFilter() || createContentFilterPlugin();
  return plugin.isGoogleAppPassword(content);
}