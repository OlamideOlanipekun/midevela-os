"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { apiRequest, storeAuth, clearAuth, getStoredAuth } from "@/lib/api/request";
import type { AdminSessionInfo } from "@/lib/auth/session";

interface AuthContextValue {
  admin: AdminSessionInfo | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue>({
  admin: null,
  loading: true,
  login: async () => ({ ok: false }),
  logout: async () => {},
  refresh: async () => false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminSessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredAuth();
    if (stored) {
      setAdmin(stored.admin);
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { ok: false, error: data.error || "Login failed" };
      }

      storeAuth(data.admin, { accessToken: data.accessToken, refreshToken: data.refreshToken });
      setAdmin(data.admin);
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error. Please try again." };
    }
  }, []);

  const logout = useCallback(async () => {
    const stored = getStoredAuth();
    if (stored) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: stored.tokens.refreshToken }),
        });
      } catch {
        // ignore network errors during logout
      }
    }
    clearAuth();
    setAdmin(null);
  }, []);

  const refresh = useCallback(async () => {
    const stored = getStoredAuth();
    if (!stored) return false;

    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: stored.tokens.refreshToken }),
      });

      if (!res.ok) {
        clearAuth();
        setAdmin(null);
        return false;
      }

      const data = await res.json();
      storeAuth(data.admin, { accessToken: data.accessToken, refreshToken: data.refreshToken });
      setAdmin(data.admin);
      return true;
    } catch {
      clearAuth();
      setAdmin(null);
      return false;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
