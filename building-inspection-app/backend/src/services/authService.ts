import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// In-memory auth store (production: replace with database)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_SESSIONS_PER_USER = 2;

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: 'inspector' | 'admin';
  createdAt: string;
}

export interface DeviceInfo {
  id: string;
  userId: string;
  deviceName: string;
  platform: string;
  userAgent: string;
  firstSeen: string;
  lastSeen: string;
}

export interface Session {
  id: string;
  userId: string;
  deviceId: string;
  token: string;
  createdAt: string;
  lastActivity: string;
  expiresAt: string;
  active: boolean;
}

// In-memory stores
const users: Map<string, User> = new Map();
const devices: Map<string, DeviceInfo> = new Map();
const sessions: Map<string, Session> = new Map();
const tokenIndex: Map<string, string> = new Map(); // token -> sessionId

// Create default admin user
const adminId = 'admin-001';
users.set(adminId, {
  id: adminId,
  email: 'admin@kuntotarkastus.fi',
  passwordHash: hashPassword('admin123'),
  name: 'Yllapitaja',
  role: 'admin',
  createdAt: new Date().toISOString(),
});

// Create default inspector
const inspectorId = 'inspector-001';
users.set(inspectorId, {
  id: inspectorId,
  email: 'tarkastaja@kuntotarkastus.fi',
  passwordHash: hashPassword('tarkastaja123'),
  name: 'Testi Tarkastaja',
  role: 'inspector',
  createdAt: new Date().toISOString(),
});

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

function generateDeviceId(userId: string, userAgent: string, platform: string): string {
  const raw = `${userId}-${userAgent}-${platform}`;
  return crypto.createHash('md5').update(raw).digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth functions
// ─────────────────────────────────────────────────────────────────────────────

export function login(
  email: string,
  password: string,
  deviceName: string,
  platform: string,
  userAgent: string
): { token: string; user: Omit<User, 'passwordHash'>; deviceId: string } | { error: string } {
  // Find user by email
  let user: User | undefined;
  for (const u of users.values()) {
    if (u.email === email) { user = u; break; }
  }

  if (!user || user.passwordHash !== hashPassword(password)) {
    return { error: 'Virheellinen sahkoposti tai salasana' };
  }

  const deviceId = generateDeviceId(user.id, userAgent, platform);
  const now = new Date().toISOString();

  // Register or update device
  if (!devices.has(deviceId)) {
    devices.set(deviceId, {
      id: deviceId,
      userId: user.id,
      deviceName,
      platform,
      userAgent,
      firstSeen: now,
      lastSeen: now,
    });
  } else {
    const dev = devices.get(deviceId)!;
    dev.lastSeen = now;
    dev.deviceName = deviceName;
  }

  // Check active sessions for this user
  const activeSessions = getActiveSessionsForUser(user.id);

  // If already at max, remove the oldest session (not from this device)
  if (activeSessions.length >= MAX_SESSIONS_PER_USER) {
    // Check if this device already has a session
    const existingDeviceSession = activeSessions.find(s => s.deviceId === deviceId);
    if (existingDeviceSession) {
      // Reuse existing session
      existingDeviceSession.lastActivity = now;
      return {
        token: existingDeviceSession.token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt },
        deviceId,
      };
    }

    // Deactivate oldest session
    const oldest = activeSessions.sort(
      (a, b) => new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime()
    )[0];
    oldest.active = false;
    tokenIndex.delete(oldest.token);
  }

  // Create new session
  const token = generateToken();
  const session: Session = {
    id: uuidv4(),
    userId: user.id,
    deviceId,
    token,
    createdAt: now,
    lastActivity: now,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    active: true,
  };

  sessions.set(session.id, session);
  tokenIndex.set(token, session.id);

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt },
    deviceId,
  };
}

export function validateToken(token: string): { user: Omit<User, 'passwordHash'>; session: Session } | null {
  const sessionId = tokenIndex.get(token);
  if (!sessionId) return null;

  const session = sessions.get(sessionId);
  if (!session || !session.active) return null;

  // Check expiry
  if (new Date(session.expiresAt) < new Date()) {
    session.active = false;
    tokenIndex.delete(token);
    return null;
  }

  const user = users.get(session.userId);
  if (!user) return null;

  // Update last activity
  session.lastActivity = new Date().toISOString();

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt },
    session,
  };
}

export function logout(token: string): boolean {
  const sessionId = tokenIndex.get(token);
  if (!sessionId) return false;

  const session = sessions.get(sessionId);
  if (session) {
    session.active = false;
  }
  tokenIndex.delete(token);
  return true;
}

export function getActiveSessionsForUser(userId: string): Session[] {
  const result: Session[] = [];
  for (const session of sessions.values()) {
    if (session.userId === userId && session.active && new Date(session.expiresAt) > new Date()) {
      result.push(session);
    }
  }
  return result;
}

export function revokeSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  session.active = false;
  tokenIndex.delete(session.token);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin functions
// ─────────────────────────────────────────────────────────────────────────────

export function getAllUsers(): Omit<User, 'passwordHash'>[] {
  return Array.from(users.values()).map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt,
  }));
}

export function getUserSessions(userId: string): Array<Session & { device?: DeviceInfo }> {
  const result: Array<Session & { device?: DeviceInfo }> = [];
  for (const session of sessions.values()) {
    if (session.userId === userId) {
      result.push({
        ...session,
        device: devices.get(session.deviceId),
      });
    }
  }
  return result.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
}

export function getUserDevices(userId: string): DeviceInfo[] {
  const result: DeviceInfo[] = [];
  for (const device of devices.values()) {
    if (device.userId === userId) {
      result.push(device);
    }
  }
  return result;
}

export function registerUser(email: string, password: string, name: string, role: 'inspector' | 'admin' = 'inspector'): Omit<User, 'passwordHash'> | { error: string } {
  // Check email uniqueness
  for (const u of users.values()) {
    if (u.email === email) return { error: 'Sahkoposti on jo kaytossa' };
  }

  const user: User = {
    id: uuidv4(),
    email,
    passwordHash: hashPassword(password),
    name,
    role,
    createdAt: new Date().toISOString(),
  };

  users.set(user.id, user);
  return { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt };
}
