/**
 * Test Suite for Content Filter Enhancer
 * Tests the false positive scenarios identified in Issue #9908
 */

import { EnhancedContentFilter, FilterContext } from '../src/contentFilter';
import { Logger, LogLevel } from '../src/logger';
import { createContentFilterPlugin } from '../src/index';

describe('EnhancedContentFilter', () => {
  let filter: EnhancedContentFilter;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = new Logger('TestFilter', LogLevel.ERROR); // Reduce test noise
    filter = new EnhancedContentFilter(mockLogger, {
      enableDevOpsWhitelist: true,
      enableConfigFileWhitelist: true,
      enableUserFileWhitelist: true,
      strictMode: false,
      customPatterns: []
    });
  });

  describe('Google App Password Detection (Issue #9908)', () => {
    it('should allow Google App Password format in SMTP context', async () => {
      const context: FilterContext = {
        message: 'Set SMTP_PASSWORD to "abcd efgh ijkl mnop" for Gmail authentication',
        files: ['.env', 'mail-config.js'],
        userIntent: 'Configure SMTP for email sending'
      };

      const result = await filter.filterContent(context);

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('DevOps workflow detected');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect Google App Password format correctly', async () => {
      const googleAppPassword = 'abcd efgh ijkl mnop';
      const context: FilterContext = {
        message: `Gmail SMTP password: ${googleAppPassword}`,
        files: ['smtp-config.js']
      };

      const result = await filter.filterContent(context);

      expect(result.allowed).toBe(true);
      expect(result.reason).toMatch(/DevOps workflow detected|Google App Password/i);
    });

    it('should block non-Google App Password formats that look similar', async () => {
      const context: FilterContext = {
        message: 'password: supersecretpassword123',
        files: ['random-file.txt']
      };

      const result = await filter.filterContent(context);

      // Should be more cautious with non-standard password formats
      expect(result.allowed).toBe(false);
    });
  });

  describe('DevOps Context Detection', () => {
    it('should recognize SMTP configuration context', async () => {
      const context: FilterContext = {
        message: 'Configure SMTP server settings for production email delivery',
        files: ['.env', 'config/mail.js', 'docker-compose.yml'],
        userIntent: 'Setup email service'
      };

      const result = await filter.filterContent(context);

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('DevOps workflow detected');
    });

    it('should recognize Docker configuration context', async () => {
      const context: FilterContext = {
        message: 'ENV DATABASE_URL=postgresql://user:password@localhost:5432/mydb',
        files: ['Dockerfile', '.env', 'docker-compose.yml']
      };

      const result = await filter.filterContent(context);

      expect(result.allowed).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should recognize Kubernetes configuration context', async () => {
      const context: FilterContext = {
        message: 'apiVersion: v1\nkind: Secret\ndata:\n  token: YWJjZGVmZ2hpams=',
        files: ['k8s-deployment.yaml', 'kubernetes-secrets.yml']
      };

      const result = await filter.filterContent(context);

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('DevOps workflow detected');
    });

    it('should recognize environment variable patterns', async () => {
      const context: FilterContext = {
        message: 'API_KEY=sk-1234567890abcdef\nDATABASE_URL=postgres://localhost:5432/db',
        files: ['.env', '.env.local']
      };

      const result = await filter.filterContent(context);

      expect(result.allowed).toBe(true);
    });
  });

  describe('Configuration File Whitelisting', () => {
    it('should allow content from .env files', async () => {
      const context: FilterContext = {
        message: 'SMTP_HOST=smtp.gmail.com\nSMTP_PASSWORD=app-specific-password',
        files: ['.env', '.env.production']
      };

      const result = await filter.filterContent(context);

      expect(result.allowed).toBe(true);
    });

    it('should allow content from configuration files', async () => {
      const context: FilterContext = {
        message: 'server {\n  listen 80;\n  server_name example.com;\n}',
        files: ['nginx.conf', 'config/server.conf']
      };

      const result = await filter.filterContent(context);

      expect(result.allowed).toBe(true);
    });
  });

  describe('False Positive Detection', () => {
    it('should catch false positives for legitimate environment variables', async () => {
      const context: FilterContext = {
        message: 'SECRET_KEY=django-insecure-development-key-only',
        files: ['.env', 'settings.py']
      };

      const result = await filter.filterContent(context);

      expect(result.allowed).toBe(true);
      // Should detect this as environment variable in proper context
    });

    it('should catch false positives for SSH keys in config', async () => {
      const context: FilterContext = {
        message: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC7... user@example.com',
        files: ['deploy-key.pub', '.ssh/authorized_keys']
      };

      const result = await filter.filterContent(context);

      expect(result.allowed).toBe(true);
    });
  });

  describe('User-Created File Context', () => {
    it('should allow content from user-created configuration files', async () => {
      const context: FilterContext = {
        message: 'database_password = "secure_password_123"',
        files: ['my-config.ini', 'app-settings.json']
      };

      const result = await filter.filterContent(context);

      expect(result.allowed).toBe(true);
    });

    it('should be more permissive with user documentation files', async () => {
      const context: FilterContext = {
        message: 'To set up SMTP, use password: abcd efgh ijkl mnop',
        files: ['README.md', 'setup-guide.txt']
      };

      const result = await filter.filterContent(context);

      expect(result.allowed).toBe(true);
    });
  });

  describe('Traditional Filtering Still Works', () => {
    it('should still block genuinely sensitive patterns', async () => {
      const context: FilterContext = {
        message: 'My credit card number is 4111-1111-1111-1111',
        files: ['random-file.txt']
      };

      const result = await filter.filterContent(context);

      expect(result.allowed).toBe(false);
    });

    it('should still block SSN patterns', async () => {
      const context: FilterContext = {
        message: 'SSN: 123-45-6789',
        files: ['personal-info.txt']
      };

      const result = await filter.filterContent(context);

      expect(result.allowed).toBe(false);
    });
  });

  describe('Custom Pattern Management', () => {
    it('should support custom whitelist patterns', () => {
      filter.addCustomPattern({
        name: 'test-pattern',
        pattern: 'TEST_TOKEN_[A-Z0-9]+',
        isWhitelist: true,
        context: ['testing']
      });

      const status = filter.getStatus();
      expect(status.customPatterns).toBe(1);
    });

    it('should remove custom patterns', () => {
      filter.addCustomPattern({
        name: 'temp-pattern',
        pattern: 'TEMP_.*',
        isWhitelist: true
      });

      const removed = filter.removeCustomPattern('temp-pattern');
      expect(removed).toBe(true);

      const status = filter.getStatus();
      expect(status.customPatterns).toBe(0);
    });
  });
});

describe('ContentFilterEnhancerPlugin', () => {
  let plugin: ReturnType<typeof createContentFilterPlugin>;

  beforeEach(() => {
    plugin = createContentFilterPlugin({
      enableDevOpsWhitelist: true,
      enableConfigFileWhitelist: true,
      enableUserFileWhitelist: true,
      logLevel: 'ERROR' // Reduce test noise
    });
  });

  describe('Plugin Integration', () => {
    it('should initialize with correct configuration', () => {
      const stats = plugin.getStats();
      expect(stats.config.enableDevOpsWhitelist).toBe(true);
      expect(stats.patterns.whitelist).toBeGreaterThan(0);
    });

    it('should filter content through plugin interface', async () => {
      const result = await plugin.filterContent(
        'SMTP_PASSWORD=abcd efgh ijkl mnop',
        ['.env'],
        'Configure email settings'
      );

      expect(result.allowed).toBe(true);
    });

    it('should detect DevOps context', () => {
      const isDevOps = plugin.isDevOpsContext(
        'Configure SMTP for production',
        ['.env', 'mail-config.js']
      );

      expect(isDevOps).toBe(true);
    });

    it('should detect Google App Password format', () => {
      const isGoogleAppPassword = plugin.isGoogleAppPassword(
        'Gmail SMTP password: abcd efgh ijkl mnop'
      );

      expect(isGoogleAppPassword).toBe(true);
    });
  });

  describe('Pattern Management', () => {
    it('should add custom whitelist patterns', () => {
      plugin.addWhitelistPattern('custom-api', 'API_KEY_[A-Z0-9]+', ['api', 'config']);

      const stats = plugin.getStats();
      expect(stats.patterns.custom).toBe(1);
    });

    it('should remove custom patterns', () => {
      plugin.addWhitelistPattern('temp-pattern', 'TEMP_.*');
      const removed = plugin.removeCustomPattern('temp-pattern');

      expect(removed).toBe(true);
    });
  });

  describe('Configuration Toggles', () => {
    it('should toggle DevOps whitelist', () => {
      plugin.toggleDevOpsWhitelist(false);
      const stats = plugin.getStats();
      expect(stats.config.enableDevOpsWhitelist).toBe(false);

      plugin.toggleDevOpsWhitelist(true);
      const stats2 = plugin.getStats();
      expect(stats2.config.enableDevOpsWhitelist).toBe(true);
    });

    it('should toggle strict mode', () => {
      plugin.setStrictMode(true);
      const stats = plugin.getStats();
      expect(stats.config.strictMode).toBe(true);
    });
  });

  describe('Statistics and Diagnostics', () => {
    it('should track filtering statistics', async () => {
      await plugin.filterContent('test content 1', []);
      await plugin.filterContent('test content 2', []);

      const stats = plugin.getStats();
      expect(stats.totalFiltered).toBe(2);
      expect(parseInt(stats.accuracy)).toBeGreaterThanOrEqual(0);
    });

    it('should provide diagnostics', () => {
      const diagnostics = plugin.getDiagnostics();

      expect(diagnostics).toHaveProperty('stats');
      expect(diagnostics).toHaveProperty('config');
      expect(diagnostics).toHaveProperty('recentLogs');
    });

    it('should reset statistics', () => {
      plugin.resetStats();
      const stats = plugin.getStats();

      expect(stats.totalFiltered).toBe(0);
      expect(stats.allowed).toBe(0);
      expect(stats.blocked).toBe(0);
    });
  });

  describe('Content Testing', () => {
    it('should provide detailed content analysis', async () => {
      const test = await plugin.testContent(
        'SMTP configuration: password=abcd efgh ijkl mnop',
        ['.env', 'mail-config.js']
      );

      expect(test.result).toHaveProperty('allowed');
      expect(test.analysis).toHaveProperty('hasDevOpsFiles');
      expect(test.analysis).toHaveProperty('isGoogleAppPassword');
    });
  });

  describe('Configuration Import/Export', () => {
    it('should export configuration', () => {
      const config = plugin.exportConfig();
      const parsed = JSON.parse(config);

      expect(parsed).toHaveProperty('config');
      expect(parsed).toHaveProperty('stats');
      expect(parsed).toHaveProperty('timestamp');
    });

    it('should import configuration', () => {
      const configData = {
        config: {
          enableDevOpsWhitelist: false,
          strictMode: true
        }
      };

      plugin.importConfig(JSON.stringify(configData));
      const stats = plugin.getStats();

      expect(stats.config.enableDevOpsWhitelist).toBe(false);
      expect(stats.config.strictMode).toBe(true);
    });
  });
});

describe('Real-World Scenarios (Issue #9908)', () => {
  let plugin: ReturnType<typeof createContentFilterPlugin>;

  beforeEach(() => {
    plugin = createContentFilterPlugin();
  });

  describe('SMTP Configuration Scenarios', () => {
    it('should allow Gmail SMTP setup with App Password', async () => {
      const result = await plugin.filterContent(
        'To configure Gmail SMTP:\nSMTP_HOST=smtp.gmail.com\nSMTP_PORT=587\nSMTP_PASSWORD=abcd efgh ijkl mnop',
        ['.env', 'config/mail.js'],
        'Setting up email service for notifications'
      );

      expect(result.allowed).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should allow Outlook SMTP configuration', async () => {
      const result = await plugin.filterContent(
        'MAIL_MAILER=smtp\nMAIL_HOST=smtp-mail.outlook.com\nMAIL_PASSWORD=my-app-password',
        ['.env', 'config/mail.php'],
        'Configure Outlook SMTP for Laravel app'
      );

      expect(result.allowed).toBe(true);
    });
  });

  describe('DevOps Workflow Scenarios', () => {
    it('should allow Docker environment configuration', async () => {
      const result = await plugin.filterContent(
        'ENV DATABASE_URL=postgresql://user:password@db:5432/myapp\nENV REDIS_URL=redis://redis:6379',
        ['Dockerfile', 'docker-compose.yml'],
        'Setting up production Docker configuration'
      );

      expect(result.allowed).toBe(true);
    });

    it('should allow Kubernetes secrets configuration', async () => {
      const result = await plugin.filterContent(
        'apiVersion: v1\nkind: Secret\nmetadata:\n  name: app-secrets\ndata:\n  api-key: YWJjZGVmZ2hpams=',
        ['k8s-secrets.yaml', 'deployment.yml'],
        'Deploy application secrets to Kubernetes'
      );

      expect(result.allowed).toBe(true);
    });

    it('should allow CI/CD pipeline configuration', async () => {
      const result = await plugin.filterContent(
        'DEPLOY_TOKEN=ghp_abcdef1234567890\nAPI_ENDPOINT=https://api.example.com',
        ['.github/workflows/deploy.yml', '.env.production'],
        'Configure deployment pipeline'
      );

      expect(result.allowed).toBe(true);
    });
  });

  describe('User Documentation Scenarios', () => {
    it('should allow setup instructions in README', async () => {
      const result = await plugin.filterContent(
        '## Email Setup\n\nFor Gmail, use an App Password:\n1. Generate password: abcd efgh ijkl mnop\n2. Set SMTP_PASSWORD in .env',
        ['README.md', 'docs/setup.md'],
        'Document email configuration process'
      );

      expect(result.allowed).toBe(true);
    });

    it('should allow configuration examples in documentation', async () => {
      const result = await plugin.filterContent(
        'Example .env file:\nDATABASE_URL=postgresql://localhost:5432/db\nAPI_KEY=your-api-key-here',
        ['INSTALL.md', 'docs/configuration.md'],
        'Provide configuration examples'
      );

      expect(result.allowed).toBe(true);
    });
  });
});