import { Platform } from 'react-native';
import { AUTH_BASE } from './config';
import { getToken, getUserRaw, saveToken, saveUserRaw, clearAuthStorage } from './authStorage';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'inspector' | 'admin';
  createdAt: string;
}

export async function getUser(): Promise<AuthUser | null> {
  const raw = await getUserRaw();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getToken();
  return !!token;
}

export async function isAdmin(): Promise<boolean> {
  const user = await getUser();
  return user?.role === 'admin';
}

const DEMO_USERS: Record<string, { password: string; user: AuthUser }> = {
  'tarkastaja@kuntotarkastus.fi': {
    password: 'tarkastaja123',
    user: {
      id: 'demo-inspector-1',
      email: 'tarkastaja@kuntotarkastus.fi',
      name: 'Demo Tarkastaja',
      role: 'inspector',
      createdAt: new Date().toISOString(),
    },
  },
  'admin@kuntotarkastus.fi': {
    password: 'admin123',
    user: {
      id: 'demo-admin-1',
      email: 'admin@kuntotarkastus.fi',
      name: 'Demo Admin',
      role: 'admin',
      createdAt: new Date().toISOString(),
    },
  },
};

export async function login(email: string, password: string): Promise<{ user: AuthUser } | { error: string }> {
  // Try demo/offline login first
  const demoUser = DEMO_USERS[email.toLowerCase()];
  if (demoUser) {
    if (demoUser.password !== password) {
      return { error: 'Väärä salasana' };
    }
    await saveToken(`demo-token-${demoUser.user.id}`);
    await saveUserRaw(JSON.stringify(demoUser.user));
    return { user: demoUser.user };
  }

  // Fall back to backend login
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${AUTH_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        deviceName: `${Platform.OS} - Expo Go`,
        platform: Platform.OS,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await response.json();
    if (!response.ok) {
      return { error: data.error || 'Kirjautuminen epäonnistui' };
    }

    await saveToken(data.token);
    await saveUserRaw(JSON.stringify(data.user));
    return { user: data.user };
  } catch {
    return { error: 'Verkkovirhe. Tarkista yhteys tai käytä testitunnuksia.' };
  }
}

export async function logout(): Promise<void> {
  const token = await getToken();
  if (token) {
    try {
      await fetch(`${AUTH_BASE}/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    } catch {
      // Ignore network errors during logout
    }
  }
  await clearAuthStorage();
}
