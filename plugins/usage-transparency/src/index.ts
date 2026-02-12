/**
 * Usage Transparency Plugin Entry Point
 * Addresses Issue #9862: Usage limit decrease without telling developers
 */

import { Logger, LogLevel } from './logger';
import { UsageMonitor, NotificationConfig, UsageStats, PolicyChange, UsageAlert } from './usageMonitor';

export interface PluginConfig extends Partial<NotificationConfig> {
  logLevel?: string;
  autoStart?: boolean;
  enableChangelogGeneration?: boolean;
}

export class UsageTransparencyPlugin {
  private logger: Logger;
  private monitor: UsageMonitor;
  private config: PluginConfig;

  constructor(config: PluginConfig = {}) {
    this.config = {
      autoStart: true,
      logLevel: 'INFO',
      enablePolicyChangeAlerts: true,
      enableUsageAlerts: true,
      enableProjections: true,
      enableChangelogGeneration: true,
      ...config
    };

    // Initialize logger
    const logLevel = LogLevel[this.config.logLevel as keyof typeof LogLevel] || LogLevel.INFO;
    this.logger = new Logger('UsageTransparency', logLevel);

    // Initialize usage monitor
    this.monitor = new UsageMonitor(this.logger, this.config);

    // Setup event handlers
    this.setupEventHandlers();

    this.logger.info('Usage Transparency plugin initialized', { config: this.config });

    // Auto-start monitoring if enabled
    if (this.config.autoStart) {
      this.startMonitoring();
    }
  }

  private setupEventHandlers(): void {
    this.monitor.on('usageUpdated', (stats: UsageStats) => {
      this.handleUsageUpdate(stats);
    });

    this.monitor.on('alert', (alert: UsageAlert) => {
      this.handleAlert(alert);
    });
  }

  private handleUsageUpdate(stats: UsageStats): void {
    // Check for critical usage levels
    const criticalPeriods = Object.entries(stats.periods)
      .filter(([_, period]) => period.percentage >= 95)
      .map(([name]) => name);

    if (criticalPeriods.length > 0) {
      console.warn(`🚨 Critical usage levels detected in: ${criticalPeriods.join(', ')}`);
    }
  }

  private handleAlert(alert: UsageAlert): void {
    // Additional plugin-level alert handling
    if (alert.type === 'policy_change' && alert.severity === 'warning') {
      console.warn('\n📢 IMPORTANT POLICY CHANGE DETECTED');
      console.warn('This change may affect your development workflow.');
      console.warn('Run `claude usage:policy-changes` for details.\n');
    }
  }

  async startMonitoring(): Promise<void> {
    this.monitor.startMonitoring();
    console.log('📊 Usage monitoring started - tracking limits and policy changes');
  }

  stopMonitoring(): void {
    this.monitor.stopMonitoring();
    console.log('Usage monitoring stopped');
  }

  async showUsageStatus(): Promise<void> {
    await this.monitor.displayUsageStatus();
  }

  async getUsageStats(): Promise<UsageStats> {
    return await this.monitor.getCurrentUsageStats();
  }

  getPolicyChanges(days?: number): PolicyChange[] {
    const changes = this.monitor.getPolicyChanges();
    if (days) {
      const since = Date.now() - (days * 24 * 60 * 60 * 1000);
      return changes.filter(change => change.date >= since);
    }
    return changes;
  }

  getAlerts(limit?: number): UsageAlert[] {
    return this.monitor.getAlerts(limit);
  }

  acknowledgeAlert(alertId: string): boolean {
    return this.monitor.acknowledgeAlert(alertId);
  }

  generateChangelogReport(days: number = 30): string {
    const changes = this.getPolicyChanges(days);
    if (changes.length === 0) {
      return `No policy changes in the last ${days} days.`;
    }

    let report = `# Claude Code Policy Changes (Last ${days} days)\n\n`;

    changes.forEach(change => {
      const date = new Date(change.date).toLocaleDateString();
      const icon = change.type === 'limit_decrease' ? '📉' : '📈';

      report += `## ${icon} ${date} - ${change.description}\n`;
      report += `**Impact**: ${change.impact}\n`;

      if (change.affectedLimits.length > 0) {
        report += `**Affected**: ${change.affectedLimits.join(', ')}\n`;
      }

      if (change.previousValues && change.newValues) {
        report += `**Changes**:\n`;
        Object.keys(change.previousValues).forEach(key => {
          report += `- ${key}: ${change.previousValues![key]} → ${change.newValues![key]}\n`;
        });
      }

      report += `**Notified**: ${change.notified ? 'Yes' : 'No ⚠️'}\n\n`;
    });

    return report;
  }
}

export function createUsageTransparencyPlugin(config?: PluginConfig): UsageTransparencyPlugin {
  return new UsageTransparencyPlugin(config);
}

export { Logger, LogLevel } from './logger';
export { UsageMonitor } from './usageMonitor';
export type { UsageStats, PolicyChange, UsageAlert, NotificationConfig } from './usageMonitor';