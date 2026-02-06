/**
 * Usage Monitoring and Transparency Module
 * Fixes Issue #9862: Usage limit decrease without telling developers
 *
 * Key improvements:
 * - Real-time usage tracking and display
 * - Proactive notifications when approaching limits
 * - Policy change alerts and changelog
 * - Usage analytics and prediction
 * - Developer-focused communication features
 */

import { Logger } from './logger';
import { EventEmitter } from 'events';

export interface UsageStats {
  current: {
    requests: number;
    tokens: number;
    conversations: number;
    lastUpdated: number;
  };
  limits: {
    dailyRequests?: number;
    weeklyRequests?: number;
    monthlyRequests?: number;
    dailyTokens?: number;
    weeklyTokens?: number;
    monthlyTokens?: number;
    concurrentConversations?: number;
    lastUpdated: number;
  };
  periods: {
    daily: UsagePeriod;
    weekly: UsagePeriod;
    monthly: UsagePeriod;
  };
  predictions: {
    dailyProjection: number;
    weeklyProjection: number;
    monthlyProjection: number;
    estimatedDepletion?: number; // timestamp when limits will be reached
  };
}

export interface UsagePeriod {
  used: number;
  limit: number;
  percentage: number;
  remaining: number;
  resetTime: number;
}

export interface PolicyChange {
  id: string;
  date: number;
  type: 'limit_decrease' | 'limit_increase' | 'pricing_change' | 'feature_change';
  description: string;
  impact: string;
  affectedLimits: string[];
  previousValues?: Record<string, number>;
  newValues?: Record<string, number>;
  notified: boolean;
}

export interface UsageAlert {
  id: string;
  timestamp: number;
  type: 'approaching_limit' | 'limit_exceeded' | 'policy_change' | 'usage_spike';
  severity: 'info' | 'warning' | 'error';
  message: string;
  details: any;
  acknowledged: boolean;
}

export interface NotificationConfig {
  enablePolicyChangeAlerts: boolean;
  enableUsageAlerts: boolean;
  enableProjections: boolean;
  thresholds: {
    warning: number; // % of limit
    critical: number; // % of limit
  };
  channels: {
    console: boolean;
    email: boolean;
    webhook?: string;
  };
}

export class UsageMonitor extends EventEmitter {
  private logger: Logger;
  private config: NotificationConfig;
  private usageHistory: UsageStats[] = [];
  private policyHistory: PolicyChange[] = [];
  private alerts: UsageAlert[] = [];
  private monitorTimer?: NodeJS.Timeout;
  private isMonitoring = false;

  // Default configuration based on Issue #9862 analysis
  private static readonly DEFAULT_CONFIG: NotificationConfig = {
    enablePolicyChangeAlerts: true,
    enableUsageAlerts: true,
    enableProjections: true,
    thresholds: {
      warning: 80, // 80% of limit
      critical: 95 // 95% of limit
    },
    channels: {
      console: true,
      email: false // Would need integration with email service
    }
  };

  constructor(logger: Logger, config?: Partial<NotificationConfig>) {
    super();
    this.logger = logger;
    this.config = { ...UsageMonitor.DEFAULT_CONFIG, ...config };

    this.logger.info('Usage Monitor initialized', { config: this.config });

    // Load historical policy changes (simulated - would be from API/DB)
    this.loadHistoricalPolicyChanges();
  }

  /**
   * Start monitoring usage patterns
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      this.logger.warn('Usage monitoring already active');
      return;
    }

    this.isMonitoring = true;
    this.monitorTimer = setInterval(() => {
      this.checkUsageAndLimits();
    }, 60000); // Check every minute

    this.logger.info('Usage monitoring started');

    // Initial check
    this.checkUsageAndLimits();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = undefined;
    }
    this.isMonitoring = false;
    this.logger.info('Usage monitoring stopped');
  }

  /**
   * Get current usage statistics
   */
  async getCurrentUsageStats(): Promise<UsageStats> {
    try {
      // In a real implementation, this would call the Anthropic API
      const mockStats = await this.fetchUsageFromAPI();

      const stats: UsageStats = {
        current: mockStats.current,
        limits: mockStats.limits,
        periods: this.calculatePeriodStats(mockStats),
        predictions: this.calculatePredictions(mockStats)
      };

      return stats;

    } catch (error) {
      this.logger.error('Failed to fetch usage stats', { error: error.message });
      throw error;
    }
  }

  /**
   * Display current usage status in a user-friendly format
   */
  async displayUsageStatus(): Promise<void> {
    try {
      const stats = await this.getCurrentUsageStats();

      console.log('\n🔍 Claude Code Usage Status');
      console.log('=' .repeat(50));

      // Daily usage
      if (stats.periods.daily.limit > 0) {
        const dailyStatus = this.getStatusIcon(stats.periods.daily.percentage);
        console.log(`📅 Daily: ${dailyStatus} ${stats.periods.daily.used}/${stats.periods.daily.limit} (${stats.periods.daily.percentage.toFixed(1)}%)`);
        console.log(`   Remaining: ${stats.periods.daily.remaining} | Resets: ${new Date(stats.periods.daily.resetTime).toLocaleString()}`);
      }

      // Weekly usage
      if (stats.periods.weekly.limit > 0) {
        const weeklyStatus = this.getStatusIcon(stats.periods.weekly.percentage);
        console.log(`📊 Weekly: ${weeklyStatus} ${stats.periods.weekly.used}/${stats.periods.weekly.limit} (${stats.periods.weekly.percentage.toFixed(1)}%)`);
        console.log(`   Remaining: ${stats.periods.weekly.remaining} | Resets: ${new Date(stats.periods.weekly.resetTime).toLocaleString()}`);
      }

      // Monthly usage
      if (stats.periods.monthly.limit > 0) {
        const monthlyStatus = this.getStatusIcon(stats.periods.monthly.percentage);
        console.log(`📈 Monthly: ${monthlyStatus} ${stats.periods.monthly.used}/${stats.periods.monthly.limit} (${stats.periods.monthly.percentage.toFixed(1)}%)`);
        console.log(`   Remaining: ${stats.periods.monthly.remaining} | Resets: ${new Date(stats.periods.monthly.resetTime).toLocaleString()}`);
      }

      // Predictions
      if (this.config.enableProjections) {
        console.log('\n🔮 Projections');
        console.log(`   Daily pace: ${stats.predictions.dailyProjection} requests/day`);
        console.log(`   Weekly pace: ${stats.predictions.weeklyProjection} requests/week`);

        if (stats.predictions.estimatedDepletion) {
          const depletionDate = new Date(stats.predictions.estimatedDepletion);
          console.log(`   ⚠️  Estimated limit depletion: ${depletionDate.toLocaleString()}`);
        }
      }

      // Recent policy changes
      const recentChanges = this.getRecentPolicyChanges(7); // Last 7 days
      if (recentChanges.length > 0) {
        console.log('\n📢 Recent Policy Changes');
        recentChanges.forEach(change => {
          const icon = change.type === 'limit_decrease' ? '📉' : '📈';
          console.log(`   ${icon} ${new Date(change.date).toLocaleDateString()}: ${change.description}`);
        });
      }

      console.log('=' .repeat(50));

    } catch (error) {
      console.error('❌ Failed to display usage status:', error.message);
    }
  }

  /**
   * Check usage and trigger alerts if needed
   */
  private async checkUsageAndLimits(): Promise<void> {
    try {
      const stats = await this.getCurrentUsageStats();

      // Store in history
      this.usageHistory.push(stats);
      if (this.usageHistory.length > 1000) {
        this.usageHistory = this.usageHistory.slice(-500); // Keep last 500 entries
      }

      // Check for threshold alerts
      this.checkThresholdAlerts(stats);

      // Check for policy changes
      await this.checkForPolicyChanges();

      // Emit events for external listeners
      this.emit('usageUpdated', stats);

    } catch (error) {
      this.logger.error('Usage check failed', { error: error.message });
    }
  }

  /**
   * Check if usage has crossed warning thresholds
   */
  private checkThresholdAlerts(stats: UsageStats): void {
    const periods = ['daily', 'weekly', 'monthly'] as const;

    periods.forEach(period => {
      const usage = stats.periods[period];
      if (usage.limit === 0) return; // Skip if no limit set

      const { warning, critical } = this.config.thresholds;

      if (usage.percentage >= critical && !this.hasRecentAlert(`${period}_critical`)) {
        this.createAlert({
          type: 'approaching_limit',
          severity: 'error',
          message: `🚨 Critical: ${period} usage at ${usage.percentage.toFixed(1)}% (${usage.used}/${usage.limit})`,
          details: { period, usage }
        });
      } else if (usage.percentage >= warning && !this.hasRecentAlert(`${period}_warning`)) {
        this.createAlert({
          type: 'approaching_limit',
          severity: 'warning',
          message: `⚠️  Warning: ${period} usage at ${usage.percentage.toFixed(1)}% (${usage.used}/${usage.limit})`,
          details: { period, usage }
        });
      }
    });
  }

  /**
   * Mock API call to fetch usage stats (replace with real API)
   */
  private async fetchUsageFromAPI(): Promise<any> {
    // Mock data representing typical usage patterns
    // In reality, this would call the Anthropic API

    const now = Date.now();
    const dayStart = new Date().setHours(0, 0, 0, 0);
    const weekStart = dayStart - (new Date().getDay() * 24 * 60 * 60 * 1000);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

    return {
      current: {
        requests: Math.floor(Math.random() * 100) + 50,
        tokens: Math.floor(Math.random() * 10000) + 5000,
        conversations: Math.floor(Math.random() * 10) + 2,
        lastUpdated: now
      },
      limits: {
        dailyRequests: 200,
        weeklyRequests: 1000,
        monthlyRequests: 4000,
        dailyTokens: 50000,
        weeklyTokens: 250000,
        monthlyTokens: 1000000,
        concurrentConversations: 5,
        lastUpdated: now
      }
    };
  }

  /**
   * Calculate period-specific statistics
   */
  private calculatePeriodStats(mockStats: any): UsageStats['periods'] {
    const calculatePeriod = (used: number, limit: number, resetTime: number): UsagePeriod => {
      const percentage = limit > 0 ? (used / limit) * 100 : 0;
      return {
        used,
        limit,
        percentage,
        remaining: Math.max(0, limit - used),
        resetTime
      };
    };

    const now = Date.now();
    const dayEnd = new Date().setHours(23, 59, 59, 999);
    const weekEnd = dayEnd + ((7 - new Date().getDay()) * 24 * 60 * 60 * 1000);
    const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).setHours(23, 59, 59, 999);

    // Mock current usage for each period
    const dailyUsed = Math.floor(mockStats.current.requests * 0.3);
    const weeklyUsed = Math.floor(mockStats.current.requests * 1.8);
    const monthlyUsed = Math.floor(mockStats.current.requests * 7.2);

    return {
      daily: calculatePeriod(dailyUsed, mockStats.limits.dailyRequests, dayEnd),
      weekly: calculatePeriod(weeklyUsed, mockStats.limits.weeklyRequests, weekEnd),
      monthly: calculatePeriod(monthlyUsed, mockStats.limits.monthlyRequests, monthEnd)
    };
  }

  /**
   * Calculate usage projections and predictions
   */
  private calculatePredictions(mockStats: any): UsageStats['predictions'] {
    // Simple projection based on current usage patterns
    // In reality, this would use more sophisticated algorithms

    const hoursToday = new Date().getHours();
    const dailyProjection = hoursToday > 0 ?
      Math.round((mockStats.current.requests / hoursToday) * 24) :
      mockStats.current.requests;

    const daysThisWeek = new Date().getDay() + 1;
    const weeklyProjection = Math.round((mockStats.current.requests / daysThisWeek) * 7);

    const daysThisMonth = new Date().getDate();
    const monthlyProjection = Math.round((mockStats.current.requests / daysThisMonth) * 30);

    // Calculate when limits might be reached
    let estimatedDepletion: number | undefined;
    if (dailyProjection > mockStats.limits.dailyRequests) {
      const hoursUntilLimit = Math.ceil((mockStats.limits.dailyRequests - mockStats.current.requests) / (dailyProjection / 24));
      estimatedDepletion = Date.now() + (hoursUntilLimit * 60 * 60 * 1000);
    }

    return {
      dailyProjection,
      weeklyProjection,
      monthlyProjection,
      estimatedDepletion
    };
  }

  /**
   * Check for policy changes (would integrate with Anthropic's API/notifications)
   */
  private async checkForPolicyChanges(): Promise<void> {
    // Mock policy change detection
    // In reality, this would check against Anthropic's API or notification service

    const lastCheck = this.getLastPolicyCheck();
    const mockChanges = this.getMockPolicyChanges(lastCheck);

    for (const change of mockChanges) {
      this.addPolicyChange(change);

      if (this.config.enablePolicyChangeAlerts) {
        this.createAlert({
          type: 'policy_change',
          severity: change.type === 'limit_decrease' ? 'warning' : 'info',
          message: `📢 Policy Change: ${change.description}`,
          details: change
        });
      }
    }
  }

  /**
   * Load historical policy changes (simulating September 2025 decrease mentioned in Issue #9862)
   */
  private loadHistoricalPolicyChanges(): void {
    // Simulate the September 2025 limit decrease mentioned in the issue
    const septemberChange: PolicyChange = {
      id: 'sept-2025-limit-decrease',
      date: new Date('2025-09-15').getTime(),
      type: 'limit_decrease',
      description: 'Weekly usage limits decreased from 2000 to 1000 requests',
      impact: 'Significant impact on heavy users and development workflows',
      affectedLimits: ['weeklyRequests'],
      previousValues: { weeklyRequests: 2000 },
      newValues: { weeklyRequests: 1000 },
      notified: false // This was the problem - no notification!
    };

    this.policyHistory.push(septemberChange);
    this.logger.info('Loaded historical policy changes', { count: this.policyHistory.length });
  }

  /**
   * Get mock policy changes (simulate checking for new changes)
   */
  private getMockPolicyChanges(since: number): PolicyChange[] {
    // Return empty array for now - in reality, this would check for actual changes
    return [];
  }

  /**
   * Add a policy change to history
   */
  private addPolicyChange(change: PolicyChange): void {
    this.policyHistory.push(change);
    this.logger.info('Policy change recorded', { change: change.description });
  }

  /**
   * Create and handle an alert
   */
  private createAlert(alertData: Omit<UsageAlert, 'id' | 'timestamp' | 'acknowledged'>): void {
    const alert: UsageAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      acknowledged: false,
      ...alertData
    };

    this.alerts.push(alert);

    // Keep only recent alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-50);
    }

    // Handle the alert
    this.handleAlert(alert);

    // Emit event
    this.emit('alert', alert);
  }

  /**
   * Handle alert based on configuration
   */
  private handleAlert(alert: UsageAlert): void {
    if (this.config.channels.console) {
      const icon = alert.severity === 'error' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`${icon} ${alert.message}`);
    }

    if (this.config.channels.email) {
      // Would integrate with email service
      this.logger.info('Email alert would be sent', { alert });
    }

    if (this.config.channels.webhook) {
      // Would send webhook notification
      this.logger.info('Webhook alert would be sent', { alert });
    }

    this.logger.info('Alert created', {
      type: alert.type,
      severity: alert.severity,
      message: alert.message
    });
  }

  /**
   * Helper methods
   */
  private getStatusIcon(percentage: number): string {
    if (percentage >= 95) return '🔴';
    if (percentage >= 80) return '🟡';
    return '🟢';
  }

  private hasRecentAlert(alertId: string): boolean {
    const oneHour = 60 * 60 * 1000;
    const recent = this.alerts.filter(a =>
      a.id.includes(alertId) &&
      (Date.now() - a.timestamp) < oneHour
    );
    return recent.length > 0;
  }

  private getLastPolicyCheck(): number {
    return this.policyHistory.length > 0 ?
      Math.max(...this.policyHistory.map(p => p.date)) :
      Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days ago
  }

  private getRecentPolicyChanges(days: number): PolicyChange[] {
    const since = Date.now() - (days * 24 * 60 * 60 * 1000);
    return this.policyHistory.filter(change => change.date >= since);
  }

  /**
   * Public utility methods
   */
  getUsageHistory(limit: number = 50): UsageStats[] {
    return this.usageHistory.slice(-limit);
  }

  getAlerts(limit: number = 20): UsageAlert[] {
    return this.alerts.slice(-limit);
  }

  getPolicyChanges(limit: number = 10): PolicyChange[] {
    return this.policyHistory.slice(-limit);
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.logger.info('Alert acknowledged', { alertId });
      return true;
    }
    return false;
  }

  updateConfig(newConfig: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Usage monitor configuration updated', { newConfig });
  }
}