import * as pty from 'node-pty';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { ClaudeSession, SessionSettings, SessionError } from '@/types';
import { DatabaseService } from './database-service';
import { Logger } from '@/utils/logger';

interface ActiveTerminal {
  ptyProcess: pty.IPty;
  outputCallback?: (data: string) => void;
}

export class SessionManager {
  private activeTerminals: Map<string, ActiveTerminal> = new Map();
  private database: DatabaseService;
  private logger: Logger;

  constructor(database: DatabaseService, logger: Logger) {
    this.database = database;
    this.logger = logger;
  }

  async createSession(
    userId: string,
    deviceId: string,
    workingDirectory: string = process.cwd(),
    settings?: Partial<SessionSettings>
  ): Promise<ClaudeSession> {
    // Validate working directory
    if (!fs.existsSync(workingDirectory)) {
      throw new SessionError(`Working directory does not exist: ${workingDirectory}`);
    }

    const sessionId = uuidv4();
    const now = new Date();

    const defaultSettings: SessionSettings = {
      shell: this.getDefaultShell(),
      theme: 'auto',
      fontSize: 14,
      fontFamily: 'Monaco, Menlo, monospace',
      autoSave: true,
      notifications: true,
    };

    const session: ClaudeSession = {
      id: sessionId,
      userId,
      deviceId,
      workingDirectory: path.resolve(workingDirectory),
      environment: this.getEnvironmentVariables(),
      status: 'active',
      createdAt: now,
      lastActivity: now,
      settings: { ...defaultSettings, ...settings },
    };

    // Create PTY process
    const ptyProcess = pty.spawn(session.settings.shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: session.workingDirectory,
      env: session.environment as Record<string, string>,
    });

    this.activeTerminals.set(sessionId, { ptyProcess });

    // Setup data handler
    ptyProcess.onData((data: string) => {
      this.updateLastActivity(sessionId);
      const terminal = this.activeTerminals.get(sessionId);
      if (terminal?.outputCallback) {
        terminal.outputCallback(data);
      }
    });

    ptyProcess.onExit((exitCode: { exitCode: number; signal?: number }) => {
      this.logger.info(`Terminal process exited for session ${sessionId}:`, exitCode);
      this.cleanupTerminal(sessionId);
    });

    // Save session to database
    await this.database.saveSession(session);

    this.logger.info(`Created session ${sessionId} for user ${userId} in ${workingDirectory}`);
    return session;
  }

  async getSession(sessionId: string): Promise<ClaudeSession | null> {
    return await this.database.getSession(sessionId);
  }

  async getUserSessions(userId: string): Promise<ClaudeSession[]> {
    return await this.database.getUserSessions(userId);
  }

  async pauseSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new SessionError(`Session not found: ${sessionId}`);
    }

    session.status = 'paused';
    session.lastActivity = new Date();

    await this.database.updateSession(session);
    
    // Keep the terminal running but remove the output callback
    const terminal = this.activeTerminals.get(sessionId);
    if (terminal) {
      terminal.outputCallback = undefined;
    }

    this.logger.info(`Paused session ${sessionId}`);
  }

  async resumeSession(sessionId: string): Promise<ClaudeSession> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new SessionError(`Session not found: ${sessionId}`);
    }

    session.status = 'active';
    session.lastActivity = new Date();

    await this.database.updateSession(session);

    // If terminal doesn't exist, recreate it
    if (!this.activeTerminals.has(sessionId)) {
      await this.recreateTerminal(session);
    }

    this.logger.info(`Resumed session ${sessionId}`);
    return session;
  }

  async terminateSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new SessionError(`Session not found: ${sessionId}`);
    }

    // Kill the terminal process
    const terminal = this.activeTerminals.get(sessionId);
    if (terminal) {
      terminal.ptyProcess.kill();
    }

    this.cleanupTerminal(sessionId);

    // Mark session as inactive
    session.status = 'inactive';
    await this.database.updateSession(session);

    this.logger.info(`Terminated session ${sessionId}`);
  }

  async writeToTerminal(sessionId: string, data: string | Buffer): Promise<void> {
    const terminal = this.activeTerminals.get(sessionId);
    if (!terminal) {
      throw new SessionError(`Terminal not found for session: ${sessionId}`);
    }

    const dataToWrite = Buffer.isBuffer(data) ? data.toString() : data;
    terminal.ptyProcess.write(dataToWrite);
    await this.updateLastActivity(sessionId);
  }

  async resizeTerminal(sessionId: string, cols: number, rows: number): Promise<void> {
    const terminal = this.activeTerminals.get(sessionId);
    if (!terminal) {
      throw new SessionError(`Terminal not found for session: ${sessionId}`);
    }

    terminal.ptyProcess.resize(cols, rows);
    this.logger.debug(`Resized terminal ${sessionId} to ${cols}x${rows}`);
  }

  onTerminalOutput(sessionId: string, callback: (data: string) => void): void {
    const terminal = this.activeTerminals.get(sessionId);
    if (terminal) {
      terminal.outputCallback = callback;
    }
  }

  private async recreateTerminal(session: ClaudeSession): Promise<void> {
    const ptyProcess = pty.spawn(session.settings.shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: session.workingDirectory,
      env: session.environment as Record<string, string>,
    });

    this.activeTerminals.set(session.id, { ptyProcess });

    ptyProcess.onData((data: string) => {
      this.updateLastActivity(session.id);
      const terminal = this.activeTerminals.get(session.id);
      if (terminal?.outputCallback) {
        terminal.outputCallback(data);
      }
    });

    ptyProcess.onExit((exitCode: { exitCode: number; signal?: number }) => {
      this.logger.info(`Terminal process exited for session ${session.id}:`, exitCode);
      this.cleanupTerminal(session.id);
    });

    this.logger.info(`Recreated terminal for session ${session.id}`);
  }

  private cleanupTerminal(sessionId: string): void {
    this.activeTerminals.delete(sessionId);
  }

  private async updateLastActivity(sessionId: string): Promise<void> {
    try {
      await this.database.updateSessionActivity(sessionId, new Date());
    } catch (error) {
      this.logger.error(`Failed to update session activity:`, error);
    }
  }

  private getDefaultShell(): string {
    if (process.platform === 'win32') {
      return process.env.SHELL || 'cmd.exe';
    }
    return process.env.SHELL || '/bin/bash';
  }

  private getEnvironmentVariables(): Record<string, string> {
    const env = { ...process.env } as Record<string, string>;
    
    // Add Claude Code specific environment variables
    env.CLAUDE_CODE_SESSION = 'true';
    env.CLAUDE_CODE_VERSION = '1.0.0';
    
    // Ensure PATH is properly set
    if (!env.PATH) {
      env.PATH = '/usr/local/bin:/usr/bin:/bin';
    }

    // Filter out undefined values
    const filteredEnv: Record<string, string> = {};
    Object.entries(env).forEach(([key, value]) => {
      if (value !== undefined) {
        filteredEnv[key] = value;
      }
    });

    return filteredEnv;
  }

  // Cleanup inactive sessions
  async cleanupInactiveSessions(maxInactiveMinutes: number = 60): Promise<void> {
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - maxInactiveMinutes);

    const inactiveSessions = await this.database.getInactiveSessions(cutoffTime);
    
    for (const session of inactiveSessions) {
      try {
        await this.terminateSession(session.id);
        this.logger.info(`Cleaned up inactive session: ${session.id}`);
      } catch (error) {
        this.logger.error(`Failed to cleanup session ${session.id}:`, error);
      }
    }
  }

  // Get active terminal count
  getActiveTerminalCount(): number {
    return this.activeTerminals.size;
  }

  // Get session statistics
  async getSessionStats(): Promise<{
    total: number;
    active: number;
    paused: number;
    inactive: number;
  }> {
    return await this.database.getSessionStats();
  }

  // Get terminal buffer for offline sync
  async getTerminalBuffer(sessionId: string): Promise<string[] | null> {
    // In a real implementation, this would retrieve buffered terminal output
    // For now, return a placeholder
    return await this.database.getTerminalBuffer(sessionId);
  }

  // Get command history for session
  async getCommandHistory(sessionId: string): Promise<string[] | null> {
    // Retrieve command history from database
    return await this.database.getCommandHistory(sessionId);
  }

  // Send input to terminal
  async sendInput(sessionId: string, input: string): Promise<void> {
    const terminal = this.activeTerminals.get(sessionId);
    if (!terminal) {
      throw new SessionError(`No active terminal for session ${sessionId}`);
    }
    
    terminal.ptyProcess.write(input);
    await this.database.addToCommandHistory(sessionId, input);
  }

  // Close all terminals
  closeAllTerminals(): void {
    this.activeTerminals.forEach((terminal, sessionId) => {
      try {
        terminal.ptyProcess.kill();
        this.logger.info(`Killed terminal for session ${sessionId}`);
      } catch (error) {
        this.logger.error(`Failed to kill terminal for session ${sessionId}:`, error);
      }
    });
    
    this.activeTerminals.clear();
  }
}