/**
 * Enhanced Logger Module for Directory Operations Debugging
 * Provides structured logging for troubleshooting Bedrock-specific issues
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
  private maxHistorySize: number = 1000;

  constructor(component: string = 'DirectoryOps', logLevel: LogLevel = LogLevel.INFO) {
    this.component = component;
    this.logLevel = logLevel;
  }

  debug(message: string, context?: any): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: any): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: any): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: any): void {
    this.log(LogLevel.ERROR, message, context);
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

    // Add to history
    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }

    // Console output with color coding
    const colorCode = this.getColorCode(level);
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
    console.log(`${colorCode}[${entry.timestamp}] [${this.component}] ${entry.level}: ${message}${contextStr}\x1b[0m`);
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
   * Get recent log entries for debugging
   */
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logHistory.slice(-count);
  }

  /**
   * Export logs for support/debugging
   */
  exportLogs(): string {
    return JSON.stringify(this.logHistory, null, 2);
  }

  /**
   * Clear log history
   */
  clearHistory(): void {
    this.logHistory = [];
  }

  /**
   * Set log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info('Log level changed', { newLevel: LogLevel[level] });
  }
}