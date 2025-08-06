import winston from 'winston';
import path from 'path';
import fs from 'fs';

export class Logger {
  private winston: winston.Logger;

  constructor(
    level: 'error' | 'warn' | 'info' | 'debug' = 'info',
    logFile?: string
  ) {
    const formats = [
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ level, message, timestamp, stack }) => {
        if (stack) {
          return `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`;
        }
        return `${timestamp} [${level.toUpperCase()}]: ${message}`;
      }),
    ];

    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          ...formats
        ),
      }),
    ];

    // Add file transport if logFile is specified
    if (logFile) {
      // Ensure log directory exists
      const logDir = path.dirname(logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      transports.push(
        new winston.transports.File({
          filename: logFile,
          format: winston.format.combine(...formats),
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          tailable: true,
        })
      );
    }

    this.winston = winston.createLogger({
      level,
      format: winston.format.combine(...formats),
      transports,
      exitOnError: false,
    });

    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (error) => {
      this.winston.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.winston.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  }

  error(message: string, error?: any): void {
    if (error) {
      this.winston.error(message, { error: error.stack || error });
    } else {
      this.winston.error(message);
    }
  }

  warn(message: string, meta?: any): void {
    this.winston.warn(message, meta);
  }

  info(message: string, meta?: any): void {
    this.winston.info(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.winston.debug(message, meta);
  }

  // Create child logger with additional context
  child(context: Record<string, any>): Logger {
    const childLogger = new Logger();
    childLogger.winston = this.winston.child(context);
    return childLogger;
  }

  // Set log level dynamically
  setLevel(level: 'error' | 'warn' | 'info' | 'debug'): void {
    this.winston.level = level;
  }

  // Get current log level
  getLevel(): string {
    return this.winston.level;
  }

  // Close logger (useful for cleanup)
  close(): void {
    this.winston.close();
  }
}