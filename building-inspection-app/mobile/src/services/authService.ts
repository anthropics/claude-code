import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { AUTH_BASE } from './api';

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'inspector' | 'admin';
  createdAt: string;
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export async function getUser(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getToken();
  return !!token;
}

export async function isAdmin(): Promise<boolean> {
  const user = await getUser();
  return user?.role === 'admin';
}

export async function login(email: string, password: string): Promise<{ user: AuthUser } | { error: string }> {
  try {
    const response = await fetch(`${AUTH_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        deviceName: `${Platform.OS} - Expo Go`,
        platform: Platform.OS,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { error: data.error || 'Kirjautuminen epäonnistui' };
    }

    await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token);
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
    return { user: data.user };
  } catch {
    return { error: 'Verkkovirhe. Tarkista yhteys.' };
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
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  await AsyncStorage.removeItem(AUTH_USER_KEY);
}
