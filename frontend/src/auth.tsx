import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from './api';
import type { AdminUser } from './types';

interface Session { token: string; user: AdminUser }

interface Auth {
  user: AdminUser | null;
  checking: boolean;
  login: (email: string, password: string) => Promise<AdminUser>;
  logout: () => void;
}

const Ctx = createContext<Auth>(null as unknown as Auth);

const KEY = 'apex_session';

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persist(session: Session | null) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [checking, setChecking] = useState<boolean>(() => !!loadSession());

  // Re-validate the stored session against the backend on boot so stale tokens
  // and deactivated accounts are caught, and the latest role is fetched.
  // A 401 clears the session; any other failure (e.g. transient network issue)
  // keeps the cached session so the user is not logged out unexpectedly.
  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    let alive = true;
    (async () => {
      try {
        const me = await api.get('/me');
        if (alive && me.user) {
          const next: Session = { token: current.token, user: me.user };
          persist(next);
          setSession(next);
        }
      } catch (e) {
        // 401 (expired/invalid token) and 403 (account deactivated) both end
        // the session. Other failures (e.g. network) keep the cached session.
        const status = (e as { status?: number }).status;
        if ((status === 401 || status === 403) && alive) {
          persist(null);
          setSession(null);
        }
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Any 401 from the API invalidates the session immediately.
  useEffect(() => {
    function onUnauthorized() {
      persist(null);
      setSession(null);
      setChecking(false);
    }
    window.addEventListener('apex:unauthorized', onUnauthorized);
    return () => window.removeEventListener('apex:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/login', { email, password });
    const next: Session = { token: res.token, user: res.user };
    persist(next);
    setSession(next);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    persist(null);
    setSession(null);
  }, []);

  return (
    <Ctx.Provider value={{ user: session?.user || null, checking, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);

// UI-level role helpers (server still enforces writes).
export const ROLE_LABEL: Record<string, string> = { admin: 'Administrator', accountant: 'Accountant', viewer: 'Viewer' };
export const isAdmin = (u: AdminUser | null) => u?.role === 'admin';
export const canEdit = (u: AdminUser | null) => u?.role === 'admin' || u?.role === 'accountant';
