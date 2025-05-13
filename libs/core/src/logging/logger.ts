import configManager from "./config/config-manager";

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Log entry interface
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  name: string;
  data?: Record<string, any>;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  format: 'json' | 'text';
  colorize: boolean;
}

/**
 * Logger class for the Claude Neural Framework
 */
export class Logger {
  private name: string;
  private config: LoggerConfig;

  /**
   * Create a new logger
   * @param name Logger name
   */
  constructor(name: string) {
    this.name = name;
    
    // Get logger configuration from config manager
    const loggingConfig = configManager.get('logging');
    this.config = {
      level: loggingConfig.level as LogLevel,
      format: loggingConfig.format,
      colorize: loggingConfig.colorize,
    };
  }

  /**
   * Log a message at the debug level
   * @param message Log message
   * @param data Additional data
   */
  public debug(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log a message at the info level
   * @param message Log message
   * @param data Additional data
   */
  public info(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log a message at the warn level
   * @param message Log message
   * @param data Additional data
   */
  public warn(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log a message at the error level
   * @param message Log message
   * @param data Additional data
   */
  public error(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * Log a message at the specified level
   * @param level Log level
   * @param message Log message
   * @param data Additional data
   */
  private log(level: LogLevel, message: string, data?: Record<string, any>): void {
    // Skip if level is below configured level
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      name: this.name,
      data,
    };

    this.writeLog(entry);
  }

  /**
   * Check if the given level should be logged
   * @param level Log level
   * @returns Whether to log the message
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const configLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= configLevelIndex;
  }

  /**
   * Write the log entry
   * @param entry Log entry
   */
  private writeLog(entry: LogEntry): void {
    if (this.config.format === 'json') {
      console.log(JSON.stringify(entry));
    } else {
      const timestamp = `[${entry.timestamp}]`;
      const levelStr = this.formatLevel(entry.level);
      const nameStr = `[${entry.name}]`;
      const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
      
      console.log(`${timestamp} ${levelStr} ${nameStr} ${entry.message}${dataStr}`);
    }
  }

  /**
   * Format the log level with colors if enabled
   * @param level Log level
   * @returns Formatted log level
   */
  private formatLevel(level: LogLevel): string {
    if (!this.config.colorize) {
      return `[${level.toUpperCase()}]`;
    }

    // ANSI color codes
    const colors = {
      reset: '\x1b[0m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
    };

    let color;
    switch (level) {
      case LogLevel.DEBUG:
        color = colors.blue;
        break;
      case LogLevel.INFO:
        color = colors.green;
        break;
      case LogLevel.WARN:
        color = colors.yellow;
        break;
      case LogLevel.ERROR:
        color = colors.red;
        break;
      default:
        color = colors.reset;
    }

    return `${color}[${level.toUpperCase()}]${colors.reset}`;
  }
}

/**
 * Create a logger with the given name
 * @param name Logger name
 * @returns Logger instance
 */
export function createLogger(name: string): Logger {
  return new Logger(name);
}

// Default logger
export default new Logger('default');