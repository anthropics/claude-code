import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { User, ClaudeSession, ClaudeCodeError } from '@/types';
import { Logger } from '@/utils/logger';

export class DatabaseService {
  private db: sqlite3.Database;
  private logger: Logger;
  private isInitialized = false;

  constructor(dbPath: string, logger: Logger) {
    this.logger = logger;
    
    // Ensure database directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        this.logger.error('Error opening database:', err);
        throw new ClaudeCodeError('Failed to open database', 'DB_ERROR');
      }
      this.logger.info(`Connected to SQLite database at ${dbPath}`);
    });

    // Enable foreign keys
    this.db.run('PRAGMA foreign_keys = ON');
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.createTables();
      this.isInitialized = true;
      this.logger.info('Database initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize database:', error);
      throw new ClaudeCodeError('Database initialization failed', 'DB_INIT_ERROR');
    }
  }

  private async createTables(): Promise<void> {
    const run = promisify(this.db.run.bind(this.db));

    // Users table
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        settings TEXT NOT NULL,
        created_at DATETIME NOT NULL,
        last_login DATETIME NOT NULL
      )
    `);

    // Devices table
    await run(`
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        platform TEXT NOT NULL,
        user_agent TEXT NOT NULL,
        last_seen DATETIME NOT NULL,
        trusted BOOLEAN NOT NULL DEFAULT 0,
        public_key TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(user_id, name)
      )
    `);

    // Sessions table
    await run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        working_directory TEXT NOT NULL,
        environment TEXT NOT NULL,
        status TEXT NOT NULL,
        settings TEXT NOT NULL,
        created_at DATETIME NOT NULL,
        last_activity DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    await run('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
    await run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await run('CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions(device_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)');
    await run('CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity)');
  }

  // User operations
  async saveUser(user: User): Promise<void> {
    const run = promisify(this.db.run.bind(this.db));

    await run(
      `INSERT INTO users (id, username, email, password_hash, settings, created_at, last_login)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.username,
        user.email,
        user.passwordHash,
        JSON.stringify(user.settings),
        user.createdAt.toISOString(),
        user.lastLogin.toISOString(),
      ]
    );

    // Save devices
    for (const device of user.devices) {
      await this.saveDevice(user.id, device);
    }
  }

  async getUser(userId: string): Promise<User | null> {
    const get = promisify(this.db.get.bind(this.db));
    const all = promisify(this.db.all.bind(this.db));

    const row = await get('SELECT * FROM users WHERE id = ?', [userId]) as any;
    if (!row) {
      return null;
    }

    // Get user devices
    const deviceRows = await all('SELECT * FROM devices WHERE user_id = ?', [userId]) as any[];

    const user: User = {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      settings: JSON.parse(row.settings),
      createdAt: new Date(row.created_at),
      lastLogin: new Date(row.last_login),
      devices: deviceRows.map(deviceRow => ({
        id: deviceRow.id,
        name: deviceRow.name,
        type: deviceRow.type,
        platform: deviceRow.platform,
        userAgent: deviceRow.user_agent,
        lastSeen: new Date(deviceRow.last_seen),
        trusted: Boolean(deviceRow.trusted),
        publicKey: deviceRow.public_key,
      })),
    };

    return user;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const get = promisify(this.db.get.bind(this.db));
    const row = await get('SELECT id FROM users WHERE username = ?', [username]) as any;
    if (!row) {
      return null;
    }
    return this.getUser(row.id);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const get = promisify(this.db.get.bind(this.db));
    const row = await get('SELECT id FROM users WHERE email = ?', [email]) as any;
    if (!row) {
      return null;
    }
    return this.getUser(row.id);
  }

  async updateUser(user: User): Promise<void> {
    const run = promisify(this.db.run.bind(this.db));

    await run(
      `UPDATE users SET username = ?, email = ?, password_hash = ?, settings = ?, last_login = ?
       WHERE id = ?`,
      [
        user.username,
        user.email,
        user.passwordHash,
        JSON.stringify(user.settings),
        user.lastLogin.toISOString(),
        user.id,
      ]
    );

    // Update devices (simple approach: delete all and recreate)
    await run('DELETE FROM devices WHERE user_id = ?', [user.id]);
    for (const device of user.devices) {
      await this.saveDevice(user.id, device);
    }
  }

  private async saveDevice(userId: string, device: any): Promise<void> {
    const run = promisify(this.db.run.bind(this.db));

    await run(
      `INSERT OR REPLACE INTO devices (id, user_id, name, type, platform, user_agent, last_seen, trusted, public_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        device.id,
        userId,
        device.name,
        device.type,
        device.platform,
        device.userAgent,
        device.lastSeen.toISOString(),
        device.trusted ? 1 : 0,
        device.publicKey,
      ]
    );
  }

  // Session operations
  async saveSession(session: ClaudeSession): Promise<void> {
    const run = promisify(this.db.run.bind(this.db));

    await run(
      `INSERT INTO sessions (id, user_id, device_id, working_directory, environment, status, settings, created_at, last_activity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.userId,
        session.deviceId,
        session.workingDirectory,
        JSON.stringify(session.environment),
        session.status,
        JSON.stringify(session.settings),
        session.createdAt.toISOString(),
        session.lastActivity.toISOString(),
      ]
    );
  }

  async getSession(sessionId: string): Promise<ClaudeSession | null> {
    const get = promisify(this.db.get.bind(this.db));

    const row = await get('SELECT * FROM sessions WHERE id = ?', [sessionId]) as any;
    if (!row) {
      return null;
    }

    const session: ClaudeSession = {
      id: row.id,
      userId: row.user_id,
      deviceId: row.device_id,
      workingDirectory: row.working_directory,
      environment: JSON.parse(row.environment),
      status: row.status,
      settings: JSON.parse(row.settings),
      createdAt: new Date(row.created_at),
      lastActivity: new Date(row.last_activity),
    };

    return session;
  }

  async getUserSessions(userId: string): Promise<ClaudeSession[]> {
    const all = promisify(this.db.all.bind(this.db));

    const rows = await all(
      'SELECT * FROM sessions WHERE user_id = ? ORDER BY last_activity DESC',
      [userId]
    ) as any[];

    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      deviceId: row.device_id,
      workingDirectory: row.working_directory,
      environment: JSON.parse(row.environment),
      status: row.status,
      settings: JSON.parse(row.settings),
      createdAt: new Date(row.created_at),
      lastActivity: new Date(row.last_activity),
    }));
  }

  async updateSession(session: ClaudeSession): Promise<void> {
    const run = promisify(this.db.run.bind(this.db));

    await run(
      `UPDATE sessions SET working_directory = ?, environment = ?, status = ?, settings = ?, last_activity = ?
       WHERE id = ?`,
      [
        session.workingDirectory,
        JSON.stringify(session.environment),
        session.status,
        JSON.stringify(session.settings),
        session.lastActivity.toISOString(),
        session.id,
      ]
    );
  }

  async updateSessionActivity(sessionId: string, lastActivity: Date): Promise<void> {
    const run = promisify(this.db.run.bind(this.db));

    await run(
      'UPDATE sessions SET last_activity = ? WHERE id = ?',
      [lastActivity.toISOString(), sessionId]
    );
  }

  async getInactiveSessions(cutoffTime: Date): Promise<ClaudeSession[]> {
    const all = promisify(this.db.all.bind(this.db));

    const rows = await all(
      'SELECT * FROM sessions WHERE last_activity < ? AND status != ?',
      [cutoffTime.toISOString(), 'inactive']
    ) as any[];

    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      deviceId: row.device_id,
      workingDirectory: row.working_directory,
      environment: JSON.parse(row.environment),
      status: row.status,
      settings: JSON.parse(row.settings),
      createdAt: new Date(row.created_at),
      lastActivity: new Date(row.last_activity),
    }));
  }

  async getSessionStats(): Promise<{
    total: number;
    active: number;
    paused: number;
    inactive: number;
  }> {
    const get = promisify(this.db.get.bind(this.db));

    const total = await get('SELECT COUNT(*) as count FROM sessions') as any;
    const active = await get('SELECT COUNT(*) as count FROM sessions WHERE status = ?', ['active']) as any;
    const paused = await get('SELECT COUNT(*) as count FROM sessions WHERE status = ?', ['paused']) as any;
    const inactive = await get('SELECT COUNT(*) as count FROM sessions WHERE status = ?', ['inactive']) as any;

    return {
      total: total.count,
      active: active.count,
      paused: paused.count,
      inactive: inactive.count,
    };
  }

  // Cleanup operations
  async cleanupOldSessions(olderThanDays: number): Promise<number> {
    const run = promisify(this.db.run.bind(this.db));
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await run(
      'DELETE FROM sessions WHERE created_at < ? AND status = ?',
      [cutoffDate.toISOString(), 'inactive']
    ) as any;

    return result.changes || 0;
  }

  // Database maintenance
  async vacuum(): Promise<void> {
    const run = promisify(this.db.run.bind(this.db));
    await run('VACUUM');
    this.logger.info('Database vacuum completed');
  }

  async getStats(): Promise<{
    users: number;
    devices: number;
    sessions: number;
    dbSize: number;
  }> {
    const get = promisify(this.db.get.bind(this.db));

    const users = await get('SELECT COUNT(*) as count FROM users') as any;
    const devices = await get('SELECT COUNT(*) as count FROM devices') as any;
    const sessions = await get('SELECT COUNT(*) as count FROM sessions') as any;

    return {
      users: users.count,
      devices: devices.count,
      sessions: sessions.count,
      dbSize: 0, // Would need filesystem call to get actual size
    };
  }

  // Close database connection
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          this.logger.error('Error closing database:', err);
          reject(err);
        } else {
          this.logger.info('Database connection closed');
          resolve();
        }
      });
    });
  }
}