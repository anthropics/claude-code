// Backend URL configuration
// For local development: use your computer's IP (e.g. http://192.168.1.100:3001)
// For pilot testing: use your public backend URL (e.g. ngrok or cloud deployment)
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://10.0.2.2:3001';

export const API_BASE = `${BACKEND_URL}/api/ai`;
export const AUTH_BASE = `${BACKEND_URL}/api/auth`;
