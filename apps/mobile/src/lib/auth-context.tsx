import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { API_BASE_URL } from '@/lib/config';
import {
  clearStoredSession,
  readStoredSession,
  sessionHeaders,
  writeStoredSession,
  type StoredSession,
} from '@/lib/session-storage';

type AuthContextValue = {
  user: StoredSession['user'] | null;
  token: string | null;
  isPending: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readAuthError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback;
  const data = payload as {
    message?: string;
    error?: { message?: string } | string;
  };
  if (typeof data.message === 'string' && data.message) return data.message;
  if (typeof data.error === 'string' && data.error) return data.error;
  if (data.error && typeof data.error === 'object' && data.error.message) {
    return data.error.message;
  }
  return fallback;
}

function extractSession(payload: unknown, cookieHeader?: string | null): StoredSession | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as {
    token?: string;
    user?: StoredSession['user'];
    session?: { token?: string };
  };
  const cookieToken = cookieHeader
    ?.match(/(?:^|,)\s*(?:__Secure-)?better-auth\.session_token=([^;]+)/)?.[1];
  const token =
    data.token ??
    data.session?.token ??
    (cookieToken ? decodeURIComponent(cookieToken) : undefined);
  const user = data.user;
  if (!token || !user?.id) return null;
  return { token, user };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const stored = await readStoredSession();
      if (!stored) {
        if (!cancelled) setIsPending(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/get-session`, {
          headers: sessionHeaders(stored.token),
        });
        const json: unknown = await response.json().catch(() => null);
        const next = extractSession(json, response.headers.get('set-cookie')) ?? (response.ok ? stored : null);

        if (!cancelled) {
          if (next) {
            setSession(next);
            await writeStoredSession(next);
          } else {
            setSession(null);
            await clearStoredSession();
          }
        }
      } catch {
        if (!cancelled) setSession(stored);
      } finally {
        if (!cancelled) setIsPending(false);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({ email, password }),
    });
    const json: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(readAuthError(json, 'Identifiants invalides'));
    }

    const next = extractSession(json, response.headers.get('set-cookie'));
    if (!next) {
      throw new Error('Connexion impossible : session invalide');
    }

    await writeStoredSession(next);
    setSession(next);
  }, []);

  const signOut = useCallback(async () => {
    const token = session?.token;
    try {
      if (token) {
        await fetch(`${API_BASE_URL}/api/auth/sign-out`, {
          method: 'POST',
          headers: sessionHeaders(token),
        });
      }
    } catch {
      // still clear local session
    }
    await clearStoredSession();
    setSession(null);
  }, [session?.token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isPending,
      signIn,
      signOut,
    }),
    [session, isPending, signIn, signOut]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const value = use(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
