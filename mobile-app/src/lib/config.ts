import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const DEFAULT_API_URL = 'http://localhost:3000';

function isLoopbackHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function getDevMachineHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  if (!hostUri) return null;

  const host = hostUri.replace(/^\w+:\/\//, '').split('/')[0]?.split(':')[0];
  if (!host || isLoopbackHost(host)) return null;
  return host;
}

function resolveApiBaseUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || DEFAULT_API_URL;

  if (Platform.OS === 'web') {
    return fromEnv;
  }

  try {
    const url = new URL(fromEnv);
    if (!isLoopbackHost(url.hostname)) {
      return fromEnv;
    }

    if (Platform.OS === 'android' && !Device.isDevice) {
      url.hostname = '10.0.2.2';
    } else {
      url.hostname = getDevMachineHost() ?? url.hostname;
    }
    return url.origin;
  } catch {
    return fromEnv;
  }
}

export const API_BASE_URL = resolveApiBaseUrl();

export function absoluteMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // URLs Vercel Blob et autres médias distants sont déjà absolues.
  if (/^(https?:|file:|data:|content:)/i.test(url)) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${API_BASE_URL}${path}`;
}
