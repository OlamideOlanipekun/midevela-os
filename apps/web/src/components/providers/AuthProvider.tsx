"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  orgId: string | null;
  avatarUrl?: string | null;
}

interface AuthContextType {
  user: SessionUser | null;
  loading: boolean;
  signUp: (input: { email: string; password: string; name: string }) => Promise<{ ok: boolean; error?: string }>;
  signIn: (input: { email: string; password: string }) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data.error || "Something went wrong. Please try again.";
  } catch {
    return "Something went wrong. Please try again.";
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signUp: AuthContextType["signUp"] = async (input) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return { ok: false, error: await parseError(res) };
    const data = await res.json();
    setUser(data.user);
    return { ok: true };
  };

  const signIn: AuthContextType["signIn"] = async (input) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return { ok: false, error: await parseError(res) };
    const data = await res.json();
    setUser(data.user);
    return { ok: true };
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
