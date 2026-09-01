import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
type Auth = { accessToken: string; refreshToken: string; user: any };
type Ctx = {
  auth: Auth | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  api: (path: string, init?: RequestInit) => Promise<any>;
};
const AuthContext = createContext<Ctx>(null as any);
const KEY = 'spheric.auth.v1';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<Auth | null>(null);
  const authRef = useRef<Auth | null>(null);
  const refreshPromise = useRef<Promise<Auth> | null>(null);
  const [ready, setReady] = useState(false);

  async function save(next: Auth | null) {
    authRef.current = next;
    setAuth(next);
    if (next) await SecureStore.setItemAsync(KEY, JSON.stringify(next), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    else await SecureStore.deleteItemAsync(KEY);
  }

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((value) => {
        if (value) {
          const parsed = JSON.parse(value) as Auth;
          authRef.current = parsed;
          setAuth(parsed);
        }
      })
      .finally(() => setReady(true));
  }, []);

  async function login(email: string, password: string) {
    const response = await fetch(`${API}/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message ?? 'Login failed');
    await save({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
  }

  async function refresh(): Promise<Auth> {
    if (refreshPromise.current) return refreshPromise.current;
    const current = authRef.current;
    if (!current) throw new Error('Not authenticated');
    refreshPromise.current = (async () => {
      const response = await fetch(`${API}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!response.ok) {
        await save(null);
        throw new Error('Session expired');
      }
      const tokens = await response.json();
      const next = { ...current, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
      await save(next);
      return next;
    })();
    try {
      return await refreshPromise.current;
    } finally {
      refreshPromise.current = null;
    }
  }

  async function call(path: string, init: RequestInit = {}) {
    const current = authRef.current;
    if (!current) throw new Error('Not authenticated');
    const perform = (session: Auth) => fetch(`${API}/v1${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.accessToken}`, ...(init.headers || {}) },
    });
    let response = await perform(current);
    if (response.status === 401) response = await perform(await refresh());
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message ?? `Request failed: ${response.status}`);
    return data;
  }

  async function logout() {
    const current = authRef.current;
    if (current) {
      try {
        await fetch(`${API}/v1/auth/logout`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
      } catch {
        // Local credential removal must still succeed if the network is unavailable.
      }
    }
    await save(null);
  }

  return <AuthContext.Provider value={{ auth, ready, login, logout, api: call }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
