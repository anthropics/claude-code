import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { Logger } from "./logging/logger";

/**
 * Framework configuration schema
 */
const FrameworkConfigSchema = z.object({
  version: z.string(),
  environment: z.enum(['development', 'testing', 'production']),
  settings: z.object({
    defaultDomain: z.enum(['documentation', 'cicd', 'data', 'general']),
    fallbackMode: z.boolean(),
    maxSteps: z.number().int().positive(),
    stepTimeout: z.number().int().positive(),
    planningDepth: z.enum(['shallow', 'medium', 'deep'])
  }),
  mcp: z.object({
    servers: z.record(z.object({
      enabled: z.boolean(),
      url: z.string().url()
    }))
  }).optional()
});

/**
 * Claude rules schema
 */
const ClaudeRulesSchema = z.object({
  allowed_directories: z.array(z.string()).optional(),
  sensitive_patterns: z.array(z.string()).optional(),
  insert_attribution: z.boolean().optional(),
  attribution_format: z.string().optional(),
  max_file_size_mb: z.number().positive().optional(),
  default_language: z.string().optional(),
  preserve_formatting: z.boolean().optional(),
  respect_existing_patterns: z.boolean().optional(),
  follow_architecture: z.boolean().optional()
});

/**
 * Framework configuration manager
 * Handles loading and accessing framework configuration files
 */
export class FrameworkConfig {
  private static instance: FrameworkConfig;
  private config: z.infer<typeof FrameworkConfigSchema> | null = null;
  private claudeRules: z.infer<typeof ClaudeRulesSchema> | null = null;
  private logger = new Logger('FrameworkConfig');
  private rootDir: string;

  private constructor() {
    // Determine the root directory of the framework
    this.rootDir = this.findRootDirectory();
    this.loadConfig();
    this.loadClaudeRules();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): FrameworkConfig {
    if (!FrameworkConfig.instance) {
      FrameworkConfig.instance = new FrameworkConfig();
    }
    return FrameworkConfig.instance;
  }

  /**
   * Find the root directory of the framework
   * Looks for package.json or .git directory
   */
  private findRootDirectory(): string {
    // Start from the current directory
    let currentDir = process.cwd();
    
    // Traverse up until we find package.json or .git
    while (currentDir !== path.parse(currentDir).root) {
      if (
        fs.existsSync(path.join(currentDir, 'package.json')) ||
        fs.existsSync(path.join(currentDir, '.git'))
      ) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
    
    // If we can't find it, use current directory
    return process.cwd();
  }

  /**
   * Load the framework configuration
   */
  private loadConfig(): void {
    try {
      // First try .claude/config.json
      const claudeConfigPath = path.join(this.rootDir, '.claude', 'config.json');
      if (fs.existsSync(claudeConfigPath)) {
        const configStr = fs.readFileSync(claudeConfigPath, 'utf-8');
        const configJson = JSON.parse(configStr);
        this.config = FrameworkConfigSchema.parse(configJson);
        this.logger.info('Loaded configuration from .claude/config.json');
        return;
      }
      
      // Fallback to default configuration
      this.config = {
        version: '1.0.0',
        environment: 'development',
        settings: {
          defaultDomain: 'documentation',
          fallbackMode: true,
          maxSteps: 20,
          stepTimeout: 30000,
          planningDepth: 'medium'
        }
      };
      this.logger.info('Using default configuration');
    } catch (error) {
      this.logger.error('Failed to load configuration', { error });
      // Use default configuration
      this.config = {
        version: '1.0.0',
        environment: 'development',
        settings: {
          defaultDomain: 'documentation',
          fallbackMode: true,
          maxSteps: 20,
          stepTimeout: 30000,
          planningDepth: 'medium'
        }
      };
    }
  }

  /**
   * Load Claude rules
   */
  private loadClaudeRules(): void {
    try {
      // Try to load .clauderules
      const claudeRulesPath = path.join(this.rootDir, '.clauderules');
      if (fs.existsSync(claudeRulesPath)) {
        const rulesStr = fs.readFileSync(claudeRulesPath, 'utf-8');
        
        // Parse YAML-like format
        const rules: Record<string, any> = {};
        let currentSection: string | null = null;
        
        for (const line of rulesStr.split('\n')) {
          // Skip comments and empty lines
          if (line.startsWith('#') || line.trim() === '') continue;
          
          // Section header
          if (line.match(/^[a-zA-Z_]+:$/)) {
            currentSection = line.replace(':', '').trim();
            rules[currentSection] = [];
            continue;
          }
          
          // Key-value pair
          const keyValueMatch = line.match(/^\s*([a-zA-Z_]+):\s*(.+)$/);
          if (keyValueMatch) {
            const [, key, value] = keyValueMatch;
            
            // Parse boolean values
            if (value === 'true') {
              rules[key] = true;
            } else if (value === 'false') {
              rules[key] = false;
            } else if (!isNaN(Number(value))) {
              rules[key] = Number(value);
            } else {
              rules[key] = value;
            }
            
            continue;
          }
          
          // List item
          if (currentSection && line.match(/^\s*-\s*(.+)$/)) {
            const itemMatch = line.match(/^\s*-\s*(.+)$/);
            if (itemMatch && Array.isArray(rules[currentSection])) {
              rules[currentSection].push(itemMatch[1].trim());
            }
          }
        }
        
        this.claudeRules = ClaudeRulesSchema.parse(rules);
        this.logger.info('Loaded Claude rules from .clauderules');
        return;
      }
      
      // Use default rules
      this.claudeRules = {
        allowed_directories: [this.rootDir],
        insert_attribution: true,
        preserve_formatting: true,
        respect_existing_patterns: true,
        follow_architecture: true
      };
      this.logger.info('Using default Claude rules');
    } catch (error) {
      this.logger.error('Failed to load Claude rules', { error });
      // Use default rules
      this.claudeRules = {
        allowed_directories: [this.rootDir],
        insert_attribution: true,
        preserve_formatting: true,
        respect_existing_patterns: true,
        follow_architecture: true
      };
    }
  }

  /**
   * Get the framework configuration
   */
  public getConfig(): z.infer<typeof FrameworkConfigSchema> {
    if (!this.config) {
      this.loadConfig();
    }
    return this.config!;
  }

  /**
   * Get Claude rules
   */
  public getClaudeRules(): z.infer<typeof ClaudeRulesSchema> {
    if (!this.claudeRules) {
      this.loadClaudeRules();
    }
    return this.claudeRules!;
  }

  /**
   * Get the root directory of the framework
   */
  public getRootDirectory(): string {
    return this.rootDir;
  }

  /**
   * Get the path to an about schema
   */
  public getAboutSchemaPath(locale: string = 'en'): string | null {
    const localeMap: Record<string, string> = {
      'en': 'about-schema.json',
      'de': 'about-schema-de.json'
    };
    
    const schemaFileName = localeMap[locale] || localeMap['en'];
    const schemaPath = path.join(this.rootDir, schemaFileName);
    
    if (fs.existsSync(schemaPath)) {
      return schemaPath;
    }
    
    // Fallback to English if localized version not found
    if (locale !== 'en') {
      const fallbackPath = path.join(this.rootDir, localeMap['en']);
      if (fs.existsSync(fallbackPath)) {
        return fallbackPath;
      }
    }
    
    return null;
  }

  /**
   * Load about schema
   */
  public loadAboutSchema(locale: string = 'en'): object | null {
    const schemaPath = this.getAboutSchemaPath(locale);
    if (!schemaPath) {
      return null;
    }
    
    try {
      const schemaStr = fs.readFileSync(schemaPath, 'utf-8');
      return JSON.parse(schemaStr);
    } catch (error) {
      this.logger.error('Failed to load about schema', { error, locale });
      return null;
    }
  }

  /**
   * Get gitignore patterns
   */
  public getGitignorePatterns(): string[] {
    try {
      const gitignorePath = path.join(this.rootDir, '.gitignore');
      if (fs.existsSync(gitignorePath)) {
        const gitignoreStr = fs.readFileSync(gitignorePath, 'utf-8');
        return gitignoreStr
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'));
      }
    } catch (error) {
      this.logger.error('Failed to load gitignore patterns', { error });
    }
    
    return [];
  }

  /**
   * Get claudeignore patterns
   */
  public getClaudeignorePatterns(): string[] {
    try {
      const claudeignorePath = path.join(this.rootDir, '.claudeignore');
      if (fs.existsSync(claudeignorePath)) {
        const claudeignoreStr = fs.readFileSync(claudeignorePath, 'utf-8');
        return claudeignoreStr
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'));
      }
    } catch (error) {
      this.logger.error('Failed to load claudeignore patterns', { error });
    }
    
    return [];
  }
}