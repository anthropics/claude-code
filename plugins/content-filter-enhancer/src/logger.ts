/**
 * Logger for Content Filter Enhancement
 * Focused on privacy and security while providing debugging capabilities
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: any;
  component: string;
}

export class Logger {
  private logLevel: LogLevel;
  private component: string;
  private logHistory: LogEntry[] = [];
  private maxHistorySize: number = 300; // Smaller for security-sensitive component

  constructor(component: string = 'ContentFilter', logLevel: LogLevel = LogLevel.INFO) {
    this.component = component;
    this.logLevel = logLevel;
  }

  debug(message: string, context?: any): void {
    this.log(LogLevel.DEBUG, message, this.sanitizeSecurityContext(context));
  }

  info(message: string, context?: any): void {
    this.log(LogLevel.INFO, message, this.sanitizeSecurityContext(context));
  }

  warn(message: string, context?: any): void {
    this.log(LogLevel.WARN, message, this.sanitizeSecurityContext(context));
  }

  error(message: string, context?: any): void {
    this.log(LogLevel.ERROR, message, this.sanitizeSecurityContext(context));
  }

  private log(level: LogLevel, message: string, context?: any): void {
    if (level < this.logLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      context,
      component: this.component
    };

    // Add to history with automatic cleanup
    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxHistorySize) {
      // Remove oldest entries when limit reached
      const toRemove = Math.floor(this.maxHistorySize * 0.3);
      this.logHistory.splice(0, toRemove);
    }

    this.outputToConsole(entry);
  }

  /**
   * Sanitize context to prevent logging sensitive information
   * This is critical for content filtering logs
   */
  private sanitizeSecurityContext(context: any): any {
    if (!context) return context;

    if (typeof context === 'string') {
      return this.sanitizeString(context);
    }

    if (typeof context === 'object') {
      const sanitized: any = {};

      for (const [key, value] of Object.entries(context)) {
        const lowerKey = key.toLowerCase();

        // Skip potentially sensitive fields
        if (lowerKey.includes('password') ||
            lowerKey.includes('token') ||
            lowerKey.includes('secret') ||
            lowerKey.includes('key') ||
            lowerKey.includes('credential')) {
          sanitized[key] = '[REDACTED]';
          continue;
        }

        if (typeof value === 'string') {
          sanitized[key] = this.sanitizeString(value);
        } else if (typeof value === 'object') {
          sanitized[key] = this.sanitizeSecurityContext(value);
        } else {
          sanitized[key] = value;
        }
      }

      return sanitized;
    }

    return context;
  }

  /**
   * Sanitize string content to avoid logging sensitive patterns
   */
  private sanitizeString(str: string): string {
    if (str.length > 500) {
      return str.substring(0, 500) + '... [truncated for security]';
    }

    // Replace potential passwords, tokens, etc. with placeholders
    return str
      .replace(/\b[A-Za-z0-9+/]{32,}={0,2}\b/g, '[POTENTIAL_TOKEN]')
      .replace(/[a-z]{4}\s[a-z]{4}\s[a-z]{4}\s[a-z]{4}/gi, '[APP_PASSWORD_FORMAT]')
      .replace(/\b\w+@\w+\.\w+\b/g, '[EMAIL]')
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP_ADDRESS]');
  }

  private outputToConsole(entry: LogEntry): void {
    const colorCode = this.getColorCode(LogLevel[entry.level as keyof typeof LogLevel]);
    const contextStr = entry.context && typeof entry.context !== 'string'
      ? ` | ${JSON.stringify(entry.context)}`
      : entry.context ? ` | ${entry.context}` : '';

    console.log(`${colorCode}[${entry.timestamp}] [${this.component}] ${entry.level}: ${entry.message}${contextStr}\x1b[0m`);
  }

  private getColorCode(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return '\x1b[36m'; // Cyan
      case LogLevel.INFO: return '\x1b[32m';  // Green
      case LogLevel.WARN: return '\x1b[33m';  // Yellow
      case LogLevel.ERROR: return '\x1b[31m'; // Red
      default: return '\x1b[0m';              // Reset
    }
  }

  /**
   * Get recent log entries (security-sanitized)
   */
  getRecentLogs(count: number = 50): LogEntry[] {
    const safeCount = Math.min(count, this.logHistory.length);
    return this.logHistory.slice(-safeCount);
  }

  /**
   * Export logs with additional security sanitization
   */
  exportLogs(maxEntries: number = 100): string {
    const entries = this.logHistory.slice(-maxEntries);
    // Additional sanitization pass for exported logs
    const sanitizedEntries = entries.map(entry => ({
      ...entry,
      message: this.sanitizeString(entry.message),
      context: this.sanitizeSecurityContext(entry.context)
    }));

    return JSON.stringify(sanitizedEntries, null, 2);
  }

  /**
   * Clear log history (important for security)
   */
  clearHistory(): void {
    this.logHistory = [];
    this.info('Log history cleared for security');
  }

  /**
   * Set log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info('Log level changed', { newLevel: LogLevel[level] });
  }

  /**
   * Get memory usage of logger itself
   */
  getMemoryUsage(): { entriesCount: number; estimatedSizeKB: number } {
    const entriesCount = this.logHistory.length;
    // Rough estimate - actual size may vary
    const estimatedSizeKB = Math.round(JSON.stringify(this.logHistory).length / 1024);

    return { entriesCount, estimatedSizeKB };
  }
}