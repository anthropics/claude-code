import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

// Configuration schema
const ConfigSchema = z.object({
  api: z.object({
    port: z.number().default(3000),
    hostname: z.string().default('localhost'),
    cors: z.boolean().default(true),
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    format: z.enum(['json', 'text']).default('json'),
    colorize: z.boolean().default(true),
  }),
  mcp: z.object({
    servers: z.record(z.object({
      enabled: z.boolean().default(true),
      url: z.string().optional(),
      autostart: z.boolean().default(false),
      command: z.string().optional(),
      args: z.array(z.string()).optional(),
      api_key_env: z.string().optional(),
    })),
  }),
  security: z.object({
    execution_confirmation: z.boolean().default(true),
    file_write_confirmation: z.boolean().default(true),
    allowed_directories: z.array(z.string()).default([]),
    blocked_commands: z.array(z.string()).default([]),
  }),
  // Add more configuration sections as needed
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Configuration manager for the Claude Neural Framework
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;
  private configPath: string;

  /**
   * Get the singleton instance of the ConfigManager
   */
  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.configPath = path.join(process.cwd(), 'configs', 'config.json');
    this.loadConfig();
  }

  /**
   * Load the configuration from the config file
   */
  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const configContent = fs.readFileSync(this.configPath, 'utf-8');
        const parsedConfig = JSON.parse(configContent);
        this.config = ConfigSchema.parse(parsedConfig);
      } else {
        console.warn(`Config file not found at ${this.configPath}, using defaults`);
        this.config = ConfigSchema.parse({});
      }
    } catch (error) {
      console.error('Error loading config:', error);
      this.config = ConfigSchema.parse({});
    }
  }

  /**
   * Get a configuration value
   * @param key Configuration key
   * @returns Configuration value
   */
  public get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  /**
   * Get the entire configuration
   * @returns Complete configuration object
   */
  public getAll(): Config {
    return this.config;
  }

  /**
   * Set a configuration value
   * @param key Configuration key
   * @param value Configuration value
   */
  public set<K extends keyof Config>(key: K, value: Config[K]): void {
    this.config[key] = value;
  }

  /**
   * Save the configuration to the config file
   */
  public save(): void {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }
}

export default ConfigManager.getInstance();