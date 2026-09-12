// ─────────────────────────────────────────────────────────────────────────────
// Auth service: Frontend authentication client
// ─────────────────────────────────────────────────────────────────────────────

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';

export interface AuthUser {
  id: string;
  email: string;
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

export interface SessionInfo {
  id: string;
  userId: string;
  deviceId: string;
  createdAt: string;
  lastActivity: string;
  expiresAt: string;
  active: boolean;
  device?: DeviceInfo;
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android-laite';
  if (/iPhone|iPad/i.test(ua)) return 'iPhone/iPad';
  if (/Windows/i.test(ua)) return 'Windows-tietokone';
  if (/Mac/i.test(ua)) return 'Mac-tietokone';
  if (/Linux/i.test(ua)) return 'Linux-tietokone';
  return 'Tuntematon laite';
}

function getPlatform(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad/i.test(ua)) return 'ios';
  return 'web';
}

export function getToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function isAdmin(): boolean {
  const user = getUser();
  return user?.role === 'admin';
}

export async function login(email: string, password: string): Promise<{ user: AuthUser } | { error: string }> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      deviceName: getDeviceName(),
      platform: getPlatform(),
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return { error: data.error || 'Kirjautuminen epaonnistui' };
  }

  localStorage.setItem(AUTH_TOKEN_KEY, data.token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
  return { user: data.user };
}

export async function logout(): Promise<void> {
  const token = getToken();
  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    } catch {
      // Ignore network errors during logout
    }
  }
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

export async function getMySessions(): Promise<SessionInfo[]> {
  const token = getToken();
  if (!token) return [];

  const response = await fetch('/api/auth/sessions', {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) return [];
  const data = await response.json();
  return data.sessions;
}

export async function getMyDevices(): Promise<DeviceInfo[]> {
  const token = getToken();
  if (!token) return [];

  const response = await fetch('/api/auth/devices', {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) return [];
  const data = await response.json();
  return data.devices;
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin functions
// ─────────────────────────────────────────────────────────────────────────────

export async function adminGetUsers(): Promise<AuthUser[]> {
  const token = getToken();
  if (!token) return [];

  const response = await fetch('/api/auth/admin/users', {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) return [];
  const data = await response.json();
  return data.users;
}

export async function adminGetUserSessions(userId: string): Promise<SessionInfo[]> {
  const token = getToken();
  if (!token) return [];

  const response = await fetch(`/api/auth/admin/user/${userId}/sessions`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) return [];
  const data = await response.json();
  return data.sessions;
}

export async function adminGetUserDevices(userId: string): Promise<DeviceInfo[]> {
  const token = getToken();
  if (!token) return [];

  const response = await fetch(`/api/auth/admin/user/${userId}/devices`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) return [];
  const data = await response.json();
  return data.devices;
}

export async function adminRevokeSession(sessionId: string): Promise<boolean> {
  const token = getToken();
  if (!token) return false;

  const response = await fetch(`/api/auth/admin/session/${sessionId}/revoke`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  return response.ok;
}

export async function adminRegisterUser(
  email: string,
  password: string,
  name: string,
  role: 'inspector' | 'admin' = 'inspector'
): Promise<AuthUser | { error: string }> {
  const token = getToken();
  if (!token) return { error: 'Not authenticated' };

  const response = await fetch('/api/auth/admin/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ email, password, name, role }),
  });

  const data = await response.json();
  if (!response.ok) return { error: data.error };
  return data.user;
}
