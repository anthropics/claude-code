/**
 * Enhanced Content Filter Module
 * Fixes Issue #9908: Content filter blocking legitimate SMTP configuration and DevOps work
 *
 * Key improvements:
 * - Context-aware filtering that recognizes DevOps workflows
 * - Whitelist for legitimate credential formats (Google App Passwords, etc.)
 * - User-created file detection and whitelisting
 * - Configuration file pattern recognition
 * - Graduated filtering based on user intent and context
 */

import { Logger } from './logger';

export interface FilterContext {
  message: string;
  files: string[];
  userIntent?: string;
  workspaceContext?: WorkspaceContext;
}

export interface WorkspaceContext {
  projectType?: string;
  hasConfigFiles: boolean;
  hasDevOpsFiles: boolean;
  isUserCreated: boolean;
  recentActivity?: string[];
}

export interface FilterResult {
  allowed: boolean;
  reason: string;
  confidence: number;
  suggestions?: string[];
}

export interface FilterConfig {
  enableDevOpsWhitelist: boolean;
  enableConfigFileWhitelist: boolean;
  enableUserFileWhitelist: boolean;
  strictMode: boolean;
  customPatterns: CustomPattern[];
}

export interface CustomPattern {
  name: string;
  pattern: string;
  isWhitelist: boolean;
  context?: string[];
}

export class EnhancedContentFilter {
  private logger: Logger;
  private config: FilterConfig;

  // Known legitimate DevOps patterns that were being blocked
  private readonly DEVOPS_WHITELISTED_PATTERNS = [
    // Google App Passwords (Issue #9908 specific case)
    /^[a-z]{4}\s[a-z]{4}\s[a-z]{4}\s[a-z]{4}$/i, // Google App Password format

    // SMTP Configuration patterns
    /smtp\.(gmail|outlook|yahoo|icloud)\.com/i,
    /mail\.(google|microsoft|yahoo|apple)\.com/i,

    // Standard environment variable formats
    /^[A-Z_][A-Z0-9_]*=[^=\s]+$/m,  // KEY=value format
    /^export\s+[A-Z_][A-Z0-9_]*=/m,   // export KEY=value

    // Docker and containerization
    /FROM\s+[\w\/:.-]+/i,
    /RUN\s+.*$/m,
    /COPY\s+.*$/m,
    /ENV\s+[A-Z_][A-Z0-9_]*=/m,

    // Kubernetes patterns
    /apiVersion:\s*[\w\/]+/i,
    /kind:\s*(Deployment|Service|ConfigMap|Secret)/i,

    // Common server configurations
    /listen\s+\d+/i,
    /server_name\s+[\w.-]+/i,
    /proxy_pass\s+http/i,

    // Database connection strings (safe formats)
    /(?:postgresql|mysql|mongodb):\/\/[\w.-]+:\d+/i,

    // API keys in configuration context (when clearly for config)
    /api[_-]?key\s*[:=]\s*['"]?[A-Za-z0-9_-]{8,}['"]?/i,

    // SSH key patterns in config files
    /ssh-(?:rsa|ed25519|dss)\s+AAAA[0-9A-Za-z+/]+[=]{0,3}/,
  ];

  // File patterns that indicate legitimate DevOps work
  private readonly DEVOPS_FILE_PATTERNS = [
    /\.env(\..*)?$/i,
    /\.env\.local$/i,
    /\.env\.example$/i,
    /docker-compose\.ya?ml$/i,
    /dockerfile$/i,
    /\.dockerignore$/i,
    /kubernetes?\.ya?ml$/i,
    /k8s\.ya?ml$/i,
    /nginx\.conf$/i,
    /apache\.conf$/i,
    /\.config$/i,
    /config\.json$/i,
    /config\.ya?ml$/i,
    /settings\.json$/i,
    /appsettings\.json$/i,
    /web\.config$/i,
    /\.ini$/i,
    /\.cfg$/i,
    /\.conf$/i,
    /serverless\.ya?ml$/i,
    /terraform\.tf$/i,
    /\.tf$/i,
    /ansible\.ya?ml$/i,
    /playbook\.ya?ml$/i,
  ];

  // Keywords that indicate legitimate DevOps intent
  private readonly DEVOPS_INTENT_KEYWORDS = [
    'smtp', 'email', 'mail', 'server', 'deploy', 'deployment', 'configure', 'configuration',
    'setup', 'install', 'docker', 'kubernetes', 'k8s', 'nginx', 'apache', 'database',
    'connection', 'auth', 'authentication', 'oauth', 'api', 'webhook', 'endpoint',
    'microservice', 'service', 'backend', 'frontend', 'infrastructure', 'terraform',
    'ansible', 'jenkins', 'ci/cd', 'pipeline', 'build', 'test', 'staging', 'production',
    'environment', 'variable', 'secret', 'credential', 'token', 'key'
  ];

  // File extensions that are typically user-created and should be whitelisted
  private readonly USER_CREATED_EXTENSIONS = [
    '.txt', '.md', '.json', '.yaml', '.yml', '.env', '.conf', '.config', '.ini', '.cfg',
    '.properties', '.toml', '.xml', '.js', '.ts', '.py', '.sh', '.bash', '.zsh', '.fish'
  ];

  constructor(logger: Logger, config?: Partial<FilterConfig>) {
    this.logger = logger;
    this.config = {
      enableDevOpsWhitelist: true,
      enableConfigFileWhitelist: true,
      enableUserFileWhitelist: true,
      strictMode: false,
      customPatterns: [],
      ...config
    };

    this.logger.info('Enhanced Content Filter initialized', { config: this.config });
  }

  /**
   * Main filtering function with context awareness
   */
  async filterContent(context: FilterContext): Promise<FilterResult> {
    this.logger.debug('Filtering content with context', {
      messageLength: context.message.length,
      fileCount: context.files.length,
      hasUserIntent: !!context.userIntent
    });

    try {
      // First, analyze the workspace context
      const workspaceContext = this.analyzeWorkspaceContext(context.files);
      const fullContext = { ...context, workspaceContext };

      // Apply context-aware filtering
      const result = await this.applyContextAwareFiltering(fullContext);

      this.logger.debug('Filtering result', {
        allowed: result.allowed,
        reason: result.reason,
        confidence: result.confidence
      });

      return result;

    } catch (error) {
      this.logger.error('Error during content filtering', { error: error.message });

      // Fail open with warning when in doubt (better than blocking legitimate work)
      return {
        allowed: true,
        reason: 'Filter error - allowing content with warning',
        confidence: 0.1,
        suggestions: ['Content filter encountered an error - please review manually']
      };
    }
  }

  /**
   * Analyze workspace context to understand project type and intent
   */
  private analyzeWorkspaceContext(files: string[]): WorkspaceContext {
    const hasConfigFiles = files.some(file =>
      this.DEVOPS_FILE_PATTERNS.some(pattern => pattern.test(file))
    );

    const hasDevOpsFiles = files.some(file => {
      const lowerFile = file.toLowerCase();
      return lowerFile.includes('docker') ||
             lowerFile.includes('k8s') ||
             lowerFile.includes('kubernetes') ||
             lowerFile.includes('terraform') ||
             lowerFile.includes('ansible') ||
             lowerFile.includes('nginx') ||
             lowerFile.includes('apache');
    });

    const isUserCreated = files.some(file =>
      this.USER_CREATED_EXTENSIONS.some(ext => file.toLowerCase().endsWith(ext))
    );

    const projectType = this.detectProjectType(files);

    return {
      projectType,
      hasConfigFiles,
      hasDevOpsFiles,
      isUserCreated
    };
  }

  /**
   * Detect project type based on file patterns
   */
  private detectProjectType(files: string[]): string {
    if (files.some(f => f.includes('docker'))) return 'containerized';
    if (files.some(f => f.includes('k8s') || f.includes('kubernetes'))) return 'kubernetes';
    if (files.some(f => f.includes('terraform'))) return 'infrastructure';
    if (files.some(f => f.includes('ansible'))) return 'automation';
    if (files.some(f => f.endsWith('.env') || f.includes('config'))) return 'configuration';
    return 'general';
  }

  /**
   * Apply context-aware filtering logic
   */
  private async applyContextAwareFiltering(context: FilterContext & { workspaceContext: WorkspaceContext }): Promise<FilterResult> {
    const { message, files, userIntent, workspaceContext } = context;

    // Check for DevOps context indicators
    if (this.isLegitimateDevOpsContext(message, files, userIntent)) {
      return {
        allowed: true,
        reason: 'DevOps workflow detected - legitimate configuration work',
        confidence: 0.9,
        suggestions: ['Continue with your DevOps configuration tasks']
      };
    }

    // Check if user is working with their own configuration files
    if (this.isUserCreatedConfigurationContext(message, workspaceContext)) {
      return {
        allowed: true,
        reason: 'User-created configuration files detected',
        confidence: 0.85,
        suggestions: ['Proceeding with user configuration files']
      };
    }

    // Check for whitelisted patterns
    const whitelistResult = this.checkWhitelistedPatterns(message);
    if (whitelistResult.isWhitelisted) {
      return {
        allowed: true,
        reason: whitelistResult.reason,
        confidence: whitelistResult.confidence
      };
    }

    // Apply traditional filtering for non-DevOps contexts
    const traditionalResult = this.applyTraditionalFiltering(message);
    if (!traditionalResult.allowed) {
      // Double-check: is this a false positive?
      const falsePositiveCheck = this.checkForFalsePositive(message, context);
      if (falsePositiveCheck.isFalsePositive) {
        return {
          allowed: true,
          reason: `Originally blocked but detected as false positive: ${falsePositiveCheck.reason}`,
          confidence: falsePositiveCheck.confidence,
          suggestions: falsePositiveCheck.suggestions
        };
      }
    }

    return traditionalResult;
  }

  /**
   * Check if context indicates legitimate DevOps work
   */
  private isLegitimateDevOpsContext(message: string, files: string[], userIntent?: string): boolean {
    if (!this.config.enableDevOpsWhitelist) return false;

    const lowerMessage = message.toLowerCase();
    const combinedText = `${message} ${userIntent || ''} ${files.join(' ')}`.toLowerCase();

    // Check for DevOps file patterns
    const hasDevOpsFiles = files.some(file =>
      this.DEVOPS_FILE_PATTERNS.some(pattern => pattern.test(file))
    );

    // Check for DevOps intent keywords
    const hasDevOpsIntent = this.DEVOPS_INTENT_KEYWORDS.some(keyword =>
      combinedText.includes(keyword)
    );

    // Specific check for SMTP configuration (Issue #9908 case)
    const isSMTPConfiguration =
      lowerMessage.includes('smtp') ||
      lowerMessage.includes('email') ||
      lowerMessage.includes('mail server') ||
      lowerMessage.includes('app password') ||
      files.some(f => f.toLowerCase().includes('mail') || f.toLowerCase().includes('smtp'));

    this.logger.debug('DevOps context check', {
      hasDevOpsFiles,
      hasDevOpsIntent,
      isSMTPConfiguration,
      fileCount: files.length
    });

    return hasDevOpsFiles && (hasDevOpsIntent || isSMTPConfiguration);
  }

  /**
   * Check if user is working with their own configuration files
   */
  private isUserCreatedConfigurationContext(message: string, workspaceContext: WorkspaceContext): boolean {
    if (!this.config.enableUserFileWhitelist) return false;

    return workspaceContext.isUserCreated &&
           workspaceContext.hasConfigFiles &&
           !this.containsSuspiciousPatterns(message);
  }

  /**
   * Check against whitelisted patterns
   */
  private checkWhitelistedPatterns(message: string): { isWhitelisted: boolean; reason: string; confidence: number } {
    // Check DevOps whitelisted patterns
    for (const pattern of this.DEVOPS_WHITELISTED_PATTERNS) {
      if (pattern.test(message)) {
        return {
          isWhitelisted: true,
          reason: 'Matches legitimate DevOps pattern',
          confidence: 0.8
        };
      }
    }

    // Check custom whitelist patterns
    for (const customPattern of this.config.customPatterns) {
      if (customPattern.isWhitelist) {
        const regex = new RegExp(customPattern.pattern, 'i');
        if (regex.test(message)) {
          return {
            isWhitelisted: true,
            reason: `Matches custom whitelist pattern: ${customPattern.name}`,
            confidence: 0.7
          };
        }
      }
    }

    return { isWhitelisted: false, reason: '', confidence: 0 };
  }

  /**
   * Apply traditional content filtering
   */
  private applyTraditionalFiltering(message: string): FilterResult {
    // Simplified traditional filtering - in reality this would be more complex
    const suspiciousPatterns = [
      /password\s*[:=]\s*['"]?(?!.*[a-z]{4}\s[a-z]{4})[^'"\s]{8,}['"]?/i, // Exclude Google App Password format
      /(?:secret|token)\s*[:=]\s*['"]?[A-Za-z0-9+/]{32,}['"]?/i,
      /(?:private[_-]?key|ssh[_-]?key)\s*[:=]/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(message)) {
        return {
          allowed: false,
          reason: 'Contains potentially sensitive information',
          confidence: 0.6,
          suggestions: [
            'Use environment variables or secure configuration files',
            'Consider using a secrets management system',
            'Verify this is not legitimate DevOps configuration'
          ]
        };
      }
    }

    return {
      allowed: true,
      reason: 'No suspicious patterns detected',
      confidence: 0.9
    };
  }

  /**
   * Check for false positives in blocked content
   */
  private checkForFalsePositive(message: string, context: FilterContext): {
    isFalsePositive: boolean;
    reason: string;
    confidence: number;
    suggestions?: string[];
  } {
    const lowerMessage = message.toLowerCase();

    // Google App Password false positive (specific to Issue #9908)
    if (/[a-z]{4}\s[a-z]{4}\s[a-z]{4}\s[a-z]{4}/i.test(message) &&
        (lowerMessage.includes('gmail') || lowerMessage.includes('google') || lowerMessage.includes('smtp'))) {
      return {
        isFalsePositive: true,
        reason: 'Google App Password format detected in SMTP context',
        confidence: 0.95,
        suggestions: ['This appears to be a legitimate Google App Password for SMTP configuration']
      };
    }

    // Configuration file content false positive
    if (context.files.some(f => this.DEVOPS_FILE_PATTERNS.some(pattern => pattern.test(f)))) {
      return {
        isFalsePositive: true,
        reason: 'Content appears to be from configuration files',
        confidence: 0.8,
        suggestions: ['This seems to be legitimate configuration file content']
      };
    }

    // Environment variable format false positive
    if (/^[A-Z_][A-Z0-9_]*=/.test(message) && context.files.some(f => f.includes('.env'))) {
      return {
        isFalsePositive: true,
        reason: 'Environment variable format in .env file context',
        confidence: 0.85,
        suggestions: ['This appears to be a standard environment variable configuration']
      };
    }

    return { isFalsePositive: false, reason: '', confidence: 0 };
  }

  /**
   * Check for genuinely suspicious patterns that should always be blocked
   */
  private containsSuspiciousPatterns(message: string): boolean {
    const alwaysBlockPatterns = [
      /(?:credit[_-]?card|cc)\s*[:=]/i,
      /\b(?:visa|mastercard|amex)\b.*\d{4}/i,
      /social[_-]?security|ssn\s*[:=]/i,
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN format
    ];

    return alwaysBlockPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Add custom pattern to whitelist or blacklist
   */
  addCustomPattern(pattern: CustomPattern): void {
    this.config.customPatterns.push(pattern);
    this.logger.info('Added custom filter pattern', { pattern: pattern.name });
  }

  /**
   * Remove custom pattern
   */
  removeCustomPattern(patternName: string): boolean {
    const initialLength = this.config.customPatterns.length;
    this.config.customPatterns = this.config.customPatterns.filter(p => p.name !== patternName);

    const removed = this.config.customPatterns.length < initialLength;
    if (removed) {
      this.logger.info('Removed custom filter pattern', { pattern: patternName });
    }

    return removed;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FilterConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Content filter configuration updated', { newConfig });
  }

  /**
   * Get current configuration and statistics
   */
  getStatus() {
    return {
      config: this.config,
      whitelistPatterns: this.DEVOPS_WHITELISTED_PATTERNS.length,
      devopsFilePatterns: this.DEVOPS_FILE_PATTERNS.length,
      intentKeywords: this.DEVOPS_INTENT_KEYWORDS.length,
      customPatterns: this.config.customPatterns.length
    };
  }
}