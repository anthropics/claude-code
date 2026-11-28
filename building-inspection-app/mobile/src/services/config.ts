import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Backend URL auto-detection for Expo Go testing.
 *
 * Priority:
 * 1. EXPO_PUBLIC_BACKEND_URL env var (explicit override)
 * 2. Auto-detect from Expo Go debugger host (same IP as dev machine, port 3001)
 * 3. Platform-specific fallback (Android emulator / iOS simulator / localhost)
 */
function getBackendUrl(): string {
  // 1. Explicit override
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }

  // 2. Auto-detect from Expo Go — the debugger host is the dev machine's LAN IP
  const debuggerHost =
    Constants.expoConfig?.hostUri || // SDK 49+
    (Constants.manifest2 as any)?.extra?.expoGo?.debuggerHost ||
    (Constants.manifest as any)?.debuggerHost;

  if (debuggerHost) {
    // debuggerHost is like "192.168.1.100:8081" — replace port with backend port
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:3001`;
  }

  // 3. Platform fallback
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001'; // Android emulator → host machine
  }
  return 'http://localhost:3001'; // iOS simulator
}

const BACKEND_URL = getBackendUrl();

export const API_BASE = `${BACKEND_URL}/api/ai`;
export const AUTH_BASE = `${BACKEND_URL}/api/auth`;
export const LEARNING_BASE = `${BACKEND_URL}/api/learning`;

// Log detected URL in dev for debugging
if (__DEV__) {
  console.log(`📡 API: ${BACKEND_URL}`);
}
