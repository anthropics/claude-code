/**
 * Logger Module for Claude Neural Framework
 * ========================================
 * 
 * Provides a standardized logging interface with consistent formatting,
 * log levels, structured metadata, and configurable outputs.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const util = require('util');
const chalk = require('chalk');

// Import configuration manager
const configManager = require('../config/config_manager');
const { CONFIG_TYPES } = configManager;

/**
 * Log levels with their priority values
 */
const LOG_LEVELS = {
  TRACE: 10,
  DEBUG: 20,
  INFO: 30,
  WARN: 40,
  ERROR: 50,
  FATAL: 60,
  SILENT: 100
};

/**
 * Default color mapping for log levels
 */
const LEVEL_COLORS = {
  [LOG_LEVELS.TRACE]: chalk.gray,
  [LOG_LEVELS.DEBUG]: chalk.blue,
  [LOG_LEVELS.INFO]: chalk.green,
  [LOG_LEVELS.WARN]: chalk.yellow,
  [LOG_LEVELS.ERROR]: chalk.red,
  [LOG_LEVELS.FATAL]: chalk.magenta.bold
};

/**
 * Default log level names
 */
const LEVEL_NAMES = {
  [LOG_LEVELS.TRACE]: 'TRACE',
  [LOG_LEVELS.DEBUG]: 'DEBUG',
  [LOG_LEVELS.INFO]: 'INFO',
  [LOG_LEVELS.WARN]: 'WARN',
  [LOG_LEVELS.ERROR]: 'ERROR',
  [LOG_LEVELS.FATAL]: 'FATAL'
};

/**
 * Error class for logging errors
 */
class LoggerError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LoggerError';
  }
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  level: LOG_LEVELS.INFO,
  format: 'json',
  colorize: true,
  timestamp: true,
  showSource: true,
  showHostname: false,
  logDirectory: path.join(os.homedir(), '.claude', 'logs'),
  filename: 'claude-neural-framework.log',
  consoleOutput: true,
  fileOutput: false,
  maxFileSize: 10 * 1024 * 1024, // 10 MB
  maxFiles: 5,
  customLevels: {},
  customFormatters: {},
  prettyPrint: false
};

/**
 * Main Logger class
 */
class Logger {
  /**
   * Create a new logger instance
   * 
   * @param {Object} options - Logger configuration options
   * @param {string} options.name - Logger name, typically the module name
   * @param {number} options.level - Minimum log level to output (default: INFO)
   * @param {string} options.format - Log format: 'json', 'text', or 'pretty' (default: 'json')
   * @param {boolean} options.colorize - Whether to colorize console output (default: true)
   * @param {boolean} options.timestamp - Whether to include timestamps (default: true)
   * @param {boolean} options.showSource - Whether to include source info (default: true)
   * @param {boolean} options.showHostname - Whether to include hostname (default: false)
   * @param {string} options.logDirectory - Directory for log files (default: ~/.claude/logs)
   * @param {string} options.filename - Log filename (default: claude-neural-framework.log)
   * @param {boolean} options.consoleOutput - Whether to output to console (default: true)
   * @param {boolean} options.fileOutput - Whether to output to file (default: false)
   * @param {number} options.maxFileSize - Maximum log file size in bytes (default: 10MB)
   * @param {number} options.maxFiles - Maximum number of log files to keep (default: 5)
   * @param {Object} options.customLevels - Custom log levels mapping
   * @param {Object} options.customFormatters - Custom formatters for log entries
   * @param {boolean} options.prettyPrint - Format JSON logs for readability (default: false)
   */
  constructor(options = {}) {
    // Get config from configuration manager
    try {
      const loggingConfig = configManager.getConfigValue(
        CONFIG_TYPES.GLOBAL,
        'logging',
        {}
      );

      // Merge defaults with configuration manager and provided options
      this.config = {
        ...DEFAULT_CONFIG,
        ...loggingConfig,
        ...options
      };
    } catch (err) {
      console.warn(`Failed to load logging configuration: ${err.message}`);
      this.config = {
        ...DEFAULT_CONFIG,
        ...options
      };
    }

    // Initialize
    this.name = this.config.name || 'default';
    this.hostname = os.hostname();
    
    // Initialize log streams if file output is enabled
    if (this.config.fileOutput) {
      this.initializeLogDirectory();
    }
    
    // Register methods for each log level
    this.addLogLevelMethods();
    
    // Initialize custom formatters
    this.formatters = {
      text: this.formatText.bind(this),
      json: this.formatJson.bind(this),
      pretty: this.formatPretty.bind(this),
      ...this.config.customFormatters
    };
  }
  
  /**
   * Initialize log directory
   * @private
   */
  initializeLogDirectory() {
    try {
      if (!fs.existsSync(this.config.logDirectory)) {
        fs.mkdirSync(this.config.logDirectory, { recursive: true });
      }
    } catch (err) {
      this.config.fileOutput = false;
      console.error(`Failed to create log directory: ${err.message}`);
    }
  }
  
  /**
   * Add log level methods (trace, debug, info, etc.)
   * @private
   */
  addLogLevelMethods() {
    // Combine default levels with custom levels
    const allLevels = {
      ...LOG_LEVELS,
      ...this.config.customLevels
    };
    
    // Add methods for each level
    Object.entries(allLevels).forEach(([levelName, levelValue]) => {
      // Skip SILENT level (used only for configuration)
      if (levelName === 'SILENT') return;
      
      // Convert levelName to lowercase for method name (e.g., INFO → info)
      const methodName = levelName.toLowerCase();
      
      this[methodName] = (message, metadata = {}) => {
        this.log(levelValue, message, metadata);
      };
    });
  }
  
  /**
   * Check if a log level should be output based on the current configuration
   * 
   * @param {number} level - Log level to check
   * @returns {boolean} Whether the log level should be output
   * @private
   */
  isLevelEnabled(level) {
    return level >= this.config.level;
  }
  
  /**
   * Get the calling source location
   * 
   * @returns {Object} Source location information
   * @private
   */
  getCallerInfo() {
    // Create an error to get the stack trace
    const err = new Error();
    const stack = err.stack.split('\n');
    
    // Parse caller info (skip this function and the log method)
    let callerLine = stack[3] || '';
    
    // Extract file path and line number
    const match = callerLine.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)/) || 
                  callerLine.match(/at\s+(.*):(\d+):(\d+)/);
    
    if (match) {
      return {
        function: match[1] || 'anonymous',
        file: path.basename(match[2] || ''),
        line: match[3] || '?',
        column: match[4] || '?'
      };
    }
    
    return {
      function: 'unknown',
      file: 'unknown',
      line: '?',
      column: '?'
    };
  }
  
  /**
   * Format the log entry as text
   * 
   * @param {Object} entry - Log entry
   * @returns {string} Formatted log entry
   * @private
   */
  formatText(entry) {
    const { timestamp, level, levelName, message, name, source, hostname, ...metadata } = entry;
    
    let formatted = '';
    
    // Add timestamp
    if (this.config.timestamp && timestamp) {
      formatted += `[${timestamp}] `;
    }
    
    // Add log level
    formatted += `${levelName} `;
    
    // Add logger name
    formatted += `[${name}] `;
    
    // Add source information
    if (this.config.showSource && source) {
      formatted += `(${source.file}:${source.line}) `;
    }
    
    // Add hostname
    if (this.config.showHostname && hostname) {
      formatted += `{${hostname}} `;
    }
    
    // Add message
    formatted += message;
    
    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      formatted += ` ${util.inspect(metadata, { depth: 4, colors: this.config.colorize })}`;
    }
    
    return formatted;
  }
  
  /**
   * Format the log entry as JSON
   * 
   * @param {Object} entry - Log entry
   * @returns {string} Formatted log entry
   * @private
   */
  formatJson(entry) {
    return JSON.stringify(entry);
  }
  
  /**
   * Format the log entry as pretty JSON
   * 
   * @param {Object} entry - Log entry
   * @returns {string} Formatted log entry
   * @private
   */
  formatPretty(entry) {
    return JSON.stringify(entry, null, 2);
  }
  
  /**
   * Log a message
   * 
   * @param {number} level - Log level
   * @param {string} message - Log message
   * @param {Object} metadata - Additional metadata
   */
  log(level, message, metadata = {}) {
    // Skip if level is below the configured minimum
    if (!this.isLevelEnabled(level)) {
      return;
    }
    
    // Get the level name
    const levelName = LEVEL_NAMES[level] || 
                      Object.keys(this.config.customLevels).find(name => this.config.customLevels[name] === level) ||
                      'UNKNOWN';
    
    // Create log entry
    const entry = {
      timestamp: this.config.timestamp ? new Date().toISOString() : undefined,
      level,
      levelName,
      message,
      name: this.name,
      ...(this.config.showSource ? { source: this.getCallerInfo() } : {}),
      ...(this.config.showHostname ? { hostname: this.hostname } : {}),
      ...metadata
    };
    
    // Format the log entry
    const formatter = this.formatters[this.config.format] || this.formatters.json;
    const formattedLog = formatter(entry);
    
    // Output to console
    if (this.config.consoleOutput) {
      this.writeToConsole(level, formattedLog);
    }
    
    // Output to file
    if (this.config.fileOutput) {
      this.writeToFile(formattedLog);
    }
    
    return entry;
  }
  
  /**
   * Write log entry to console
   * 
   * @param {number} level - Log level
   * @param {string} formattedLog - Formatted log entry
   * @private
   */
  writeToConsole(level, formattedLog) {
    // Choose output stream based on level
    const outputStream = level >= LOG_LEVELS.ERROR ? console.error : console.log;
    
    // Apply colors if enabled
    if (this.config.colorize && LEVEL_COLORS[level]) {
      outputStream(LEVEL_COLORS[level](formattedLog));
    } else {
      outputStream(formattedLog);
    }
  }
  
  /**
   * Write log entry to file
   * 
   * @param {string} formattedLog - Formatted log entry
   * @private
   */
  writeToFile(formattedLog) {
    try {
      const logFilePath = path.join(this.config.logDirectory, this.config.filename);
      
      // Check if file exists and needs rotation
      this.rotateLogFileIfNeeded(logFilePath);
      
      // Append log to file
      fs.appendFileSync(logFilePath, formattedLog + '\n');
    } catch (err) {
      // Fall back to console if file writing fails
      console.error(`Failed to write to log file: ${err.message}`);
    }
  }
  
  /**
   * Rotate log file if it exceeds the maximum size
   * 
   * @param {string} logFilePath - Path to the log file
   * @private
   */
  rotateLogFileIfNeeded(logFilePath) {
    try {
      // Check if file exists
      if (!fs.existsSync(logFilePath)) {
        return;
      }
      
      // Check file size
      const stats = fs.statSync(logFilePath);
      if (stats.size < this.config.maxFileSize) {
        return;
      }
      
      // Rotate logs
      for (let i = this.config.maxFiles - 1; i > 0; i--) {
        const oldPath = `${logFilePath}.${i}`;
        const newPath = `${logFilePath}.${i + 1}`;
        
        if (fs.existsSync(oldPath)) {
          fs.renameSync(oldPath, newPath);
        }
      }
      
      // Rename current log file
      fs.renameSync(logFilePath, `${logFilePath}.1`);
    } catch (err) {
      console.error(`Failed to rotate log file: ${err.message}`);
    }
  }
  
  /**
   * Create a child logger with inherited configuration
   * 
   * @param {Object} options - Child logger options
   * @returns {Logger} Child logger instance
   */
  child(options = {}) {
    return new Logger({
      ...this.config,
      ...options
    });
  }
  
  /**
   * Update logger configuration
   * 
   * @param {Object} options - New configuration options
   */
  configure(options = {}) {
    this.config = {
      ...this.config,
      ...options
    };
    
    // Reinitialize log directory if needed
    if (this.config.fileOutput) {
      this.initializeLogDirectory();
    }
  }
  
  /**
   * Set the log level
   * 
   * @param {number|string} level - Log level (number or level name)
   */
  setLevel(level) {
    if (typeof level === 'string') {
      const levelValue = LOG_LEVELS[level.toUpperCase()] || 
                        this.config.customLevels[level.toUpperCase()];
      
      if (levelValue) {
        this.config.level = levelValue;
      } else {
        throw new LoggerError(`Unknown log level: ${level}`);
      }
    } else if (typeof level === 'number') {
      this.config.level = level;
    } else {
      throw new LoggerError(`Invalid log level type: ${typeof level}`);
    }
  }
}

/**
 * Create the default singleton logger instance
 */
const defaultLogger = new Logger({
  name: 'claude-neural-framework'
});

/**
 * Export the Logger class, LOG_LEVELS enum, LoggerError class, and default logger instance
 */
module.exports = defaultLogger;
module.exports.Logger = Logger;
module.exports.LOG_LEVELS = LOG_LEVELS;
module.exports.LoggerError = LoggerError;

/**
 * Factory function to create a new logger instance
 * 
 * @param {Object|string} options - Logger options or logger name
 * @returns {Logger} New logger instance
 */
module.exports.createLogger = (options) => {
  if (typeof options === 'string') {
    return new Logger({ name: options });
  }
  
  return new Logger(options);
};