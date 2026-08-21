import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const STORAGE_KEY = 'mobileapp_session_v1';

export type StoredSession = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role?: string | null;
    image?: string | null;
  };
};

export function sessionHeaders(
  token?: string | null,
  options: { json?: boolean } = {}
): HeadersInit {
  const headers: Record<string, string> = {
    'expo-origin': 'mobileapp://',
  };
  if (options.json !== false) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function webGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function webSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // quota / private mode
  }
}

function webRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export async function readStoredSession(): Promise<StoredSession | null> {
  try {
    const raw =
      Platform.OS === 'web'
        ? webGet(STORAGE_KEY)
        : await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function writeStoredSession(session: StoredSession) {
  const raw = JSON.stringify(session);
  if (Platform.OS === 'web') {
    webSet(STORAGE_KEY, raw);
    return;
  }
  await SecureStore.setItemAsync(STORAGE_KEY, raw);
}

export async function clearStoredSession() {
  if (Platform.OS === 'web') {
    webRemove(STORAGE_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}
