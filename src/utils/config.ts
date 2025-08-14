import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { ServerConfig } from '@/types';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: ServerConfig;
  private configPath: string;

  private constructor() {
    this.configPath = this.getConfigPath();
    this.config = this.loadConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private getConfigPath(): string {
    const configDir = process.env.CLAUDE_CONFIG_DIR || 
      path.join(os.homedir(), '.claude-code-extended');
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    return path.join(configDir, 'config.json');
  }

  private getDefaultConfig(): ServerConfig {
    return {
      port: 3000,
      host: '0.0.0.0',
      ssl: {
        enabled: false,
      },
      auth: {
        jwtSecret: this.generateJwtSecret(),
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
        maxDevicesPerUser: 10,
      },
      database: {
        path: path.join(path.dirname(this.configPath), 'claude-code.db'),
      },
      tailscale: {
        enabled: false,
      },
      logging: {
        level: 'info',
        file: path.join(path.dirname(this.configPath), 'logs', 'claude-code.log'),
      },
      rateLimiting: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
      },
    };
  }

  private loadConfig(): ServerConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        
        // Try to parse JSON, handle corruption
        let loadedConfig: any;
        try {
          loadedConfig = JSON.parse(configData);
        } catch (parseError) {
          console.error(`Config file corrupted: ${parseError}`);
          
          // Try to restore from backup
          const backupPath = `${this.configPath}.backup`;
          if (fs.existsSync(backupPath)) {
            console.log('Restoring from backup...');
            const backupData = fs.readFileSync(backupPath, 'utf8');
            try {
              loadedConfig = JSON.parse(backupData);
              fs.copyFileSync(backupPath, this.configPath);
              console.log('Successfully restored from backup');
            } catch (backupError) {
              console.error('Backup also corrupted, using defaults');
              throw backupError;
            }
          } else {
            throw parseError;
          }
        }
        
        // Merge with defaults to ensure all properties exist
        return this.mergeWithDefaults(loadedConfig);
      }
    } catch (error) {
      console.warn(`Failed to load config from ${this.configPath}:`, error);
    }

    // Return default config if file doesn't exist or loading failed
    const defaultConfig = this.getDefaultConfig();
    this.saveConfig(defaultConfig);
    return defaultConfig;
  }

  private mergeWithDefaults(loadedConfig: any): ServerConfig {
    const defaultConfig = this.getDefaultConfig();
    
    return {
      port: loadedConfig.port || defaultConfig.port,
      host: loadedConfig.host || defaultConfig.host,
      ssl: {
        enabled: loadedConfig.ssl?.enabled || defaultConfig.ssl.enabled,
        cert: loadedConfig.ssl?.cert || defaultConfig.ssl.cert,
        key: loadedConfig.ssl?.key || defaultConfig.ssl.key,
      },
      auth: {
        jwtSecret: loadedConfig.auth?.jwtSecret || defaultConfig.auth.jwtSecret,
        sessionTimeout: loadedConfig.auth?.sessionTimeout || defaultConfig.auth.sessionTimeout,
        maxDevicesPerUser: loadedConfig.auth?.maxDevicesPerUser || defaultConfig.auth.maxDevicesPerUser,
      },
      database: {
        path: loadedConfig.database?.path || defaultConfig.database.path,
      },
      tailscale: {
        enabled: loadedConfig.tailscale?.enabled || defaultConfig.tailscale.enabled,
        authKey: loadedConfig.tailscale?.authKey || defaultConfig.tailscale.authKey,
        hostname: loadedConfig.tailscale?.hostname || defaultConfig.tailscale.hostname,
      },
      logging: {
        level: loadedConfig.logging?.level || defaultConfig.logging.level,
        file: loadedConfig.logging?.file || defaultConfig.logging.file,
      },
      rateLimiting: {
        windowMs: loadedConfig.rateLimiting?.windowMs || defaultConfig.rateLimiting.windowMs,
        max: loadedConfig.rateLimiting?.max || defaultConfig.rateLimiting.max,
      },
    };
  }

  public getConfig(): ServerConfig {
    return { ...this.config }; // Return a copy
  }

  public updateConfig(updates: Partial<ServerConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig(this.config);
  }

  public saveConfig(config?: ServerConfig): void {
    const configToSave = config || this.config;
    
    try {
      // Validate JSON
      const jsonString = JSON.stringify(configToSave, null, 2);
      JSON.parse(jsonString); // Ensure valid JSON
      
      // Create backup before writing
      if (fs.existsSync(this.configPath)) {
        try {
          const currentData = fs.readFileSync(this.configPath, 'utf8');
          JSON.parse(currentData); // Only backup if current is valid
          fs.copyFileSync(this.configPath, `${this.configPath}.backup`);
        } catch (e) {
          // Current config invalid, skip backup
        }
      }
      
      // Atomic write: write to temp file then rename
      const tempPath = `${this.configPath}.tmp.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`;
      fs.writeFileSync(tempPath, jsonString, { mode: 0o644 });
      
      // Verify temp file is valid
      const tempContent = fs.readFileSync(tempPath, 'utf8');
      JSON.parse(tempContent);
      
      // Atomic rename
      fs.renameSync(tempPath, this.configPath);
      
      // Clean up old backups (keep only 5)
      this.cleanupOldBackups();
    } catch (error) {
      console.error(`Failed to save config to ${this.configPath}:`, error);
      
      // Clean up temp files
      try {
        const dir = path.dirname(this.configPath);
        const tempFiles = fs.readdirSync(dir)
          .filter(f => f.startsWith(path.basename(this.configPath) + '.tmp.'));
        tempFiles.forEach(f => {
          try {
            fs.unlinkSync(path.join(dir, f));
          } catch (e) {}
        });
      } catch (e) {}
      
      throw error;
    }
  }

  public getConfigFilePath(): string {
    return this.configPath;
  }

  public getDataDirectory(): string {
    return path.dirname(this.configPath);
  }

  private generateJwtSecret(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  // Environment variable overrides
  public static applyEnvironmentOverrides(config: ServerConfig): ServerConfig {
    return {
      ...config,
      port: parseInt(process.env.CLAUDE_PORT || '') || config.port,
      host: process.env.CLAUDE_HOST || config.host,
      ssl: {
        ...config.ssl,
        enabled: process.env.CLAUDE_SSL_ENABLED === 'true' || config.ssl.enabled,
        cert: process.env.CLAUDE_SSL_CERT || config.ssl.cert,
        key: process.env.CLAUDE_SSL_KEY || config.ssl.key,
      },
      auth: {
        ...config.auth,
        jwtSecret: process.env.CLAUDE_JWT_SECRET || config.auth.jwtSecret,
        sessionTimeout: parseInt(process.env.CLAUDE_SESSION_TIMEOUT || '') || config.auth.sessionTimeout,
        maxDevicesPerUser: parseInt(process.env.CLAUDE_MAX_DEVICES || '') || config.auth.maxDevicesPerUser,
      },
      database: {
        ...config.database,
        path: process.env.CLAUDE_DB_PATH || config.database.path,
      },
      tailscale: {
        ...config.tailscale,
        enabled: process.env.TAILSCALE_ENABLED === 'true' || config.tailscale.enabled,
        authKey: process.env.TAILSCALE_AUTH_KEY || config.tailscale.authKey,
        hostname: process.env.TAILSCALE_HOSTNAME || config.tailscale.hostname,
      },
      logging: {
        ...config.logging,
        level: (process.env.CLAUDE_LOG_LEVEL as any) || config.logging.level,
        file: process.env.CLAUDE_LOG_FILE || config.logging.file,
      },
    };
  }

  // Validation
  public validateConfig(config: ServerConfig): string[] {
    const errors: string[] = [];

    if (config.port < 1 || config.port > 65535) {
      errors.push('Port must be between 1 and 65535');
    }

    if (!config.auth.jwtSecret || config.auth.jwtSecret.length < 32) {
      errors.push('JWT secret must be at least 32 characters long');
    }

    if (config.auth.sessionTimeout < 60000) { // 1 minute minimum
      errors.push('Session timeout must be at least 1 minute (60000ms)');
    }

    if (config.auth.maxDevicesPerUser < 1 || config.auth.maxDevicesPerUser > 100) {
      errors.push('Max devices per user must be between 1 and 100');
    }

    if (config.ssl.enabled && (!config.ssl.cert || !config.ssl.key)) {
      errors.push('SSL certificate and key are required when SSL is enabled');
    }

    if (!['error', 'warn', 'info', 'debug'].includes(config.logging.level)) {
      errors.push('Logging level must be one of: error, warn, info, debug');
    }

    return errors;
  }

  // Reset to defaults
  public resetToDefaults(): void {
    this.config = this.getDefaultConfig();
    this.saveConfig();
  }

  // Backup and restore
  public createBackup(): string {
    const backupPath = `${this.configPath}.backup.${Date.now()}`;
    fs.copyFileSync(this.configPath, backupPath);
    return backupPath;
  }

  public restoreBackup(backupPath: string): void {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    fs.copyFileSync(backupPath, this.configPath);
    this.config = this.loadConfig();
  }

  private cleanupOldBackups(): void {
    try {
      const dir = path.dirname(this.configPath);
      const configName = path.basename(this.configPath);
      const backupPattern = new RegExp(`^${configName}\\.backup\\.\\d+$`);
      
      const backups = fs.readdirSync(dir)
        .filter(f => backupPattern.test(f))
        .map(f => ({
          name: f,
          path: path.join(dir, f),
          time: parseInt(f.split('.').pop() || '0')
        }))
        .sort((a, b) => b.time - a.time);
      
      // Keep only 5 most recent
      if (backups.length > 5) {
        backups.slice(5).forEach(backup => {
          try {
            fs.unlinkSync(backup.path);
          } catch (e) {}
        });
      }
    } catch (error) {
      // Silently ignore cleanup errors
    }
  }
}