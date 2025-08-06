#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import crypto from 'crypto';
import { ConfigManager } from '@/utils/config';
import { DatabaseService } from '@/services/database-service';
import { AuthService } from '@/services/auth-service';
import { Logger } from '@/utils/logger';
import { ServerConfig, SetupWizardConfig, ValidationError } from '@/types';

class SetupWizard {
  private rl: readline.Interface;
  private config: SetupWizardConfig;
  private logger: Logger;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.logger = new Logger('info');
    this.config = {
      serverConfig: {},
      userConfig: {
        username: '',
        password: '',
      },
      deviceConfig: {
        name: '',
        type: 'desktop',
      },
    };
  }

  private async question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  private async questionHidden(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      // Hide input for passwords
      const stdin = process.stdin;
      const stdout = process.stdout;

      stdout.write(prompt);
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');

      let input = '';
      const onData = (char: string) => {
        switch (char) {
          case '\n':
          case '\r':
          case '\u0004': // Ctrl+D
            stdin.setRawMode(false);
            stdin.pause();
            stdin.removeListener('data', onData);
            stdout.write('\n');
            resolve(input);
            break;
          case '\u0003': // Ctrl+C
            process.exit();
            break;
          case '\u007f': // Backspace
            if (input.length > 0) {
              input = input.slice(0, -1);
              stdout.write('\b \b');
            }
            break;
          default:
            input += char;
            stdout.write('*');
            break;
        }
      };

      stdin.on('data', onData);
    });
  }

  private displayWelcome(): void {
    console.log('\n🚀 Welcome to Claude Code Extended Setup\n');
    console.log('This wizard will help you configure your Claude Code Extended server.');
    console.log('You can change these settings later by editing the configuration file.\n');
  }

  private async promptServerConfig(): Promise<void> {
    console.log('📡 Server Configuration\n');

    // Port
    const portStr = await this.question(`Server port (default: 3000): `);
    const port = parseInt(portStr) || 3000;
    if (port < 1 || port > 65535) {
      console.log('❌ Invalid port number. Using default: 3000');
      this.config.serverConfig.port = 3000;
    } else {
      this.config.serverConfig.port = port;
    }

    // Host
    const host = await this.question(`Server host (default: 0.0.0.0): `);
    this.config.serverConfig.host = host || '0.0.0.0';

    // SSL Configuration
    const sslEnabled = await this.question(`Enable SSL/HTTPS? (y/n, default: n): `);
    if (sslEnabled.toLowerCase() === 'y' || sslEnabled.toLowerCase() === 'yes') {
      const certPath = await this.question(`SSL certificate path: `);
      const keyPath = await this.question(`SSL private key path: `);
      
      if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        this.config.serverConfig.ssl = {
          enabled: true,
          cert: certPath,
          key: keyPath,
        };
        console.log('✅ SSL configuration saved');
      } else {
        console.log('❌ SSL certificate or key file not found. SSL disabled.');
        this.config.serverConfig.ssl = { enabled: false };
      }
    } else {
      this.config.serverConfig.ssl = { enabled: false };
    }

    console.log('');
  }

  private async promptUserConfig(): Promise<void> {
    console.log('👤 Admin User Configuration\n');

    // Username
    let username = '';
    while (!username) {
      username = await this.question(`Admin username: `);
      if (username.length < 3) {
        console.log('❌ Username must be at least 3 characters long.');
        username = '';
      }
    }
    this.config.userConfig.username = username;

    // Password
    let password = '';
    let confirmPassword = '';
    while (!password) {
      password = await this.questionHidden(`Admin password: `);
      if (password.length < 8) {
        console.log('❌ Password must be at least 8 characters long.');
        password = '';
        continue;
      }

      confirmPassword = await this.questionHidden(`Confirm password: `);
      if (password !== confirmPassword) {
        console.log('❌ Passwords do not match.');
        password = '';
        continue;
      }
    }
    this.config.userConfig.password = password;

    // Email (optional)
    const email = await this.question(`Admin email (optional): `);
    if (email && this.isValidEmail(email)) {
      this.config.userConfig.email = email;
    }

    console.log('✅ Admin user configuration saved\n');
  }

  private async promptDeviceConfig(): Promise<void> {
    console.log('📱 Initial Device Configuration\n');

    // Device name
    const defaultDeviceName = `${os.hostname()}-setup`;
    const deviceName = await this.question(`Device name (default: ${defaultDeviceName}): `);
    this.config.deviceConfig.name = deviceName || defaultDeviceName;

    // Device type
    const deviceType = await this.question(`Device type (desktop/mobile/tablet, default: desktop): `);
    const validTypes = ['desktop', 'mobile', 'tablet'];
    this.config.deviceConfig.type = validTypes.includes(deviceType) ? deviceType as any : 'desktop';

    console.log('✅ Device configuration saved\n');
  }

  private async promptAdvancedConfig(): Promise<void> {
    const advanced = await this.question(`Configure advanced settings? (y/n, default: n): `);
    
    if (advanced.toLowerCase() === 'y' || advanced.toLowerCase() === 'yes') {
      console.log('\n⚙️  Advanced Configuration\n');

      // JWT Secret
      const generateJwt = await this.question(`Generate JWT secret automatically? (y/n, default: y): `);
      if (generateJwt.toLowerCase() === 'n' || generateJwt.toLowerCase() === 'no') {
        const jwtSecret = await this.question(`JWT secret (minimum 32 characters): `);
        if (jwtSecret.length >= 32) {
          this.config.serverConfig.auth = { 
            jwtSecret,
            sessionTimeout: 24 * 60 * 60 * 1000,
            maxDevicesPerUser: 10
          };
        } else {
          console.log('❌ JWT secret too short. Auto-generating...');
        }
      }

      // Session timeout
      const sessionTimeoutStr = await this.question(`Session timeout in hours (default: 24): `);
      const sessionTimeoutHours = parseInt(sessionTimeoutStr) || 24;
      if (!this.config.serverConfig.auth) {
        this.config.serverConfig.auth = {
          jwtSecret: crypto.randomBytes(64).toString('hex'),
          sessionTimeout: sessionTimeoutHours * 60 * 60 * 1000,
          maxDevicesPerUser: 10
        };
      } else {
        this.config.serverConfig.auth.sessionTimeout = sessionTimeoutHours * 60 * 60 * 1000;
      }

      // Max devices per user
      const maxDevicesStr = await this.question(`Max devices per user (default: 10): `);
      const maxDevices = parseInt(maxDevicesStr) || 10;
      if (this.config.serverConfig.auth) {
        this.config.serverConfig.auth.maxDevicesPerUser = maxDevices;
      }

      // Logging level
      const logLevel = await this.question(`Log level (error/warn/info/debug, default: info): `);
      const validLevels = ['error', 'warn', 'info', 'debug'];
      this.config.serverConfig.logging = {
        level: validLevels.includes(logLevel) ? logLevel as any : 'info',
      };

      console.log('✅ Advanced configuration saved\n');
    }
  }

  private async promptTailscaleConfig(): Promise<void> {
    const enableTailscale = await this.question(`Enable Tailscale integration? (y/n, default: n): `);
    
    if (enableTailscale.toLowerCase() === 'y' || enableTailscale.toLowerCase() === 'yes') {
      console.log('\n🔗 Tailscale Configuration\n');
      console.log('Note: You need a Tailscale account and auth key for this to work.');
      console.log('Visit https://tailscale.com/ to get started.\n');

      const authKey = await this.question(`Tailscale auth key: `);
      const hostname = await this.question(`Tailscale hostname (optional): `);

      this.config.serverConfig.tailscale = {
        enabled: true,
        authKey: authKey || undefined,
        hostname: hostname || undefined,
      };

      console.log('✅ Tailscale configuration saved\n');
    } else {
      this.config.serverConfig.tailscale = { enabled: false };
    }
  }

  private async createConfiguration(): Promise<void> {
    console.log('💾 Creating configuration...\n');

    try {
      // Generate JWT secret if not provided
      if (!this.config.serverConfig.auth?.jwtSecret) {
        const jwtSecret = crypto.randomBytes(64).toString('hex');
        this.config.serverConfig.auth = {
          jwtSecret,
          sessionTimeout: this.config.serverConfig.auth?.sessionTimeout || 24 * 60 * 60 * 1000,
          maxDevicesPerUser: this.config.serverConfig.auth?.maxDevicesPerUser || 10,
        };
      }

      // Create config manager and save configuration
      const configManager = ConfigManager.getInstance();
      configManager.updateConfig(this.config.serverConfig);

      console.log(`✅ Configuration saved to: ${configManager.getConfigFilePath()}`);

      // Initialize database and create admin user
      await this.createAdminUser();

      console.log('✅ Setup completed successfully!\n');

    } catch (error) {
      console.error('❌ Failed to create configuration:', error);
      throw error;
    }
  }

  private async createAdminUser(): Promise<void> {
    try {
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();
      
      // Initialize services
      const logger = new Logger('info');
      const database = new DatabaseService(config.database.path, logger);
      await database.initialize();

      const authService = new AuthService(
        database,
        logger,
        config.auth.jwtSecret,
        config.auth.sessionTimeout,
        config.auth.maxDevicesPerUser
      );

      // Create admin user
      const user = await authService.createUser(
        this.config.userConfig.username,
        this.config.userConfig.password,
        this.config.userConfig.email
      );

      // Add initial device
      await authService.addDevice(user.id, {
        deviceName: this.config.deviceConfig.name,
        deviceType: this.config.deviceConfig.type,
        platform: `${os.platform()} ${os.release()}`,
        userAgent: 'Claude Code Extended Setup',
      });

      console.log(`✅ Admin user created: ${user.username}`);
      console.log(`✅ Initial device registered: ${this.config.deviceConfig.name}`);

      await database.close();
    } catch (error) {
      if (error instanceof ValidationError && error.message.includes('already exists')) {
        console.log('⚠️  Admin user already exists, skipping creation');
      } else {
        throw error;
      }
    }
  }

  private displaySummary(): void {
    const configManager = ConfigManager.getInstance();
    const config = configManager.getConfig();

    console.log('📋 Setup Summary:\n');
    console.log(`Server: ${config.ssl?.enabled ? 'https' : 'http'}://${config.host}:${config.port}`);
    console.log(`Admin User: ${this.config.userConfig.username}`);
    console.log(`Device: ${this.config.deviceConfig.name} (${this.config.deviceConfig.type})`);
    console.log(`SSL Enabled: ${config.ssl?.enabled ? 'Yes' : 'No'}`);
    console.log(`Tailscale: ${config.tailscale?.enabled ? 'Yes' : 'No'}`);
    console.log(`Database: ${config.database.path}`);
    console.log(`Config: ${configManager.getConfigFilePath()}\n`);

    console.log('🚀 To start the server, run:');
    console.log('  npm start\n');
    console.log('  or');
    console.log('  claude-server\n');
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  public async run(): Promise<void> {
    try {
      this.displayWelcome();
      await this.promptServerConfig();
      await this.promptUserConfig();
      await this.promptDeviceConfig();
      await this.promptAdvancedConfig();
      await this.promptTailscaleConfig();
      await this.createConfiguration();
      this.displaySummary();
    } catch (error) {
      console.error('\n❌ Setup failed:', error);
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }
}

// Run setup wizard if this file is executed directly
if (require.main === module) {
  const wizard = new SetupWizard();
  wizard.run().catch((error) => {
    console.error('Setup wizard failed:', error);
    process.exit(1);
  });
}

export default SetupWizard;