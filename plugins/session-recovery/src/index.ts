/**
 * Session Recovery Plugin Entry Point
 * Addresses Issue #9800: Resume functionality requires manual workaround
 */

import { Logger, LogLevel } from './logger';
import { EnhancedSessionManager, SessionConfig, SessionData, SessionMetadata } from './sessionManager';

export interface PluginConfig extends Partial<SessionConfig> {
  logLevel?: string;
  autoRepair?: boolean;
}

export class SessionRecoveryPlugin {
  private logger: Logger;
  private sessionManager: EnhancedSessionManager;
  private config: PluginConfig;

  constructor(config: PluginConfig = {}) {
    this.config = {
      autoRepair: true,
      logLevel: 'INFO',
      enableAutoBackup: true,
      enableChecksumValidation: true,
      maxBackups: 5,
      oauthRefreshThreshold: 15,
      ...config
    };

    const logLevel = LogLevel[this.config.logLevel as keyof typeof LogLevel] || LogLevel.INFO;
    this.logger = new Logger('SessionRecovery', logLevel);

    this.sessionManager = new EnhancedSessionManager(this.logger, this.config);

    this.logger.info('Session Recovery plugin initialized');
  }

  async resumeSession(sessionId: string): Promise<SessionData> {
    console.log(`🔄 Resuming session: ${sessionId}`);
    
    try {
      const sessionData = await this.sessionManager.resumeSession(sessionId);
      console.log(`✅ Session resumed successfully (${sessionData.messages.length} messages)`);
      return sessionData;
    } catch (error) {
      console.error(`❌ Session resume failed: ${error.message}`);
      throw error;
    }
  }

  async listSessions(): Promise<SessionMetadata[]> {
    return await this.sessionManager.listSessions();
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return await this.sessionManager.deleteSession(sessionId);
  }

  async saveSession(sessionData: SessionData): Promise<void> {
    await this.sessionManager.saveSession(sessionData);
  }
}

export function createSessionRecoveryPlugin(config?: PluginConfig): SessionRecoveryPlugin {
  return new SessionRecoveryPlugin(config);
}

export { Logger, LogLevel } from './logger';
export { EnhancedSessionManager } from './sessionManager';
export type { SessionData, SessionMetadata, SessionConfig } from './sessionManager';