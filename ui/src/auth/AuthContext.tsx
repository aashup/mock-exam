import {createContext, useContext, useEffect, useMemo, useState} from 'react';
import type {ReactNode} from 'react';
import {getToken, setToken, clearAuthStorage} from '@/api/client';
import * as authApi from '@/api/auth';
import type {User} from '@/types/models';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAdmin: boolean;
  /** Logs in; throws if credentials are bad or the account is not an admin. */
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const USER_KEY = 'admin_user';

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export class NotAdminError extends Error {
  constructor() {
    super('This account is not an admin. Admin access is required.');
    this.name = 'NotAdminError';
  }
}

export function AuthProvider({children}: {children: ReactNode}) {
  const [user, setUser] = useState<User | null>(loadStoredUser);
  const [token, setTokenState] = useState<string | null>(getToken());
  const [loading, setLoading] = useState(true);

  // On mount, if we have a token, re-validate it against /auth/me so a stale
  // or revoked token doesn't leave the UI in a fake logged-in state.
  useEffect(() => {
    let active = true;
    (async () => {
      // No token → make sure no stale cached user lingers (e.g. after the
      // backend DB was reset and the old token is gone but the user remains).
      if (!getToken()) {
        if (active) {
          clearAuthStorage();
          setUser(null);
          setTokenState(null);
          setLoading(false);
        }
        return;
      }
      try {
        const fresh = await authApi.me();
        if (active) {
          if (fresh.role === 'admin') {
            setUser(fresh);
            setTokenState(getToken());
            localStorage.setItem(USER_KEY, JSON.stringify(fresh));
          } else {
            // Non-admin token — clear everything.
            clearAuthStorage();
            setUser(null);
            setTokenState(null);
          }
        }
      } catch {
        // 401 (revoked/stale token) handled by the interceptor; clear local state.
        if (active) {
          clearAuthStorage();
          setUser(null);
          setTokenState(null);
        }
      }
      if (active) {
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    if (res.user.role !== 'admin') {
      // Do NOT persist a non-admin token.
      throw new NotAdminError();
    }
    setToken(res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setTokenState(res.token);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore network/401 errors on logout — we clear locally regardless.
    }
    setToken(null);
    localStorage.removeItem(USER_KEY);
    setTokenState(null);
    setUser(null);
  };

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      loading,
      isAdmin: !!token && user?.role === 'admin',
      login,
      logout,
    }),
    [user, token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
