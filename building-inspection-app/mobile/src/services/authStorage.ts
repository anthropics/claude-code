import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';

// In-memory fallback when AsyncStorage is unavailable
let memoryToken: string | null = null;
let memoryUser: string | null = null;

export async function saveToken(token: string): Promise<void> {
  memoryToken = token;
  try { await AsyncStorage.setItem(AUTH_TOKEN_KEY, token); } catch {}
}

export async function saveUserRaw(userJson: string): Promise<void> {
  memoryUser = userJson;
  try { await AsyncStorage.setItem(AUTH_USER_KEY, userJson); } catch {}
}

export async function getToken(): Promise<string | null> {
  if (memoryToken) return memoryToken;
  try { return await AsyncStorage.getItem(AUTH_TOKEN_KEY); } catch { return null; }
}

export async function getUserRaw(): Promise<string | null> {
  if (memoryUser) return memoryUser;
  try { return await AsyncStorage.getItem(AUTH_USER_KEY); } catch { return null; }
}

export async function clearAuthStorage(): Promise<void> {
  memoryToken = null;
  memoryUser = null;
  try { await AsyncStorage.removeItem(AUTH_TOKEN_KEY); } catch {}
  try { await AsyncStorage.removeItem(AUTH_USER_KEY); } catch {}
}
