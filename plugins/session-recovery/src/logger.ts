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
  private maxHistorySize: number = 200;

  constructor(component: string = 'SessionRecovery', logLevel: LogLevel = LogLevel.INFO) {
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
    if (level < this.logLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      context,
      component: this.component
    };

    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }

    const colorCode = this.getColorCode(level);
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    console.log(`${colorCode}[${entry.timestamp}] [${this.component}] ${entry.level}: ${message}${contextStr}\x1b[0m`);
  }

  private getColorCode(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return '\x1b[36m';
      case LogLevel.INFO: return '\x1b[32m';
      case LogLevel.WARN: return '\x1b[33m';
      case LogLevel.ERROR: return '\x1b[31m';
      default: return '\x1b[0m';
    }
  }

  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logHistory.slice(-count);
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
}