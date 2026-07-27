import type { AdminSessionInfo } from "@/lib/auth/session";

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  admin: AdminSessionInfo;
  tokens: Tokens;
}

const STORAGE_KEY = "midevela_admin_auth";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getStoredAuth(): AuthState | null {
  if (!isBrowser()) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

export function storeAuth(admin: AdminSessionInfo, tokens: Tokens): void {
  if (!isBrowser()) return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ admin, tokens }));
}

export function clearAuth(): void {
  if (!isBrowser()) return;
  sessionStorage.removeItem(STORAGE_KEY);
}

export function getAccessToken(): string | null {
  return getStoredAuth()?.tokens.accessToken ?? null;
}

async function refreshAccessToken(): Promise<string | null> {
  const auth = getStoredAuth();
  if (!auth) return null;

  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: auth.tokens.refreshToken }),
    });

    if (!res.ok) {
      clearAuth();
      return null;
    }

    const data = await res.json();
    const newTokens: Tokens = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };

    storeAuth(data.admin, newTokens);
    return newTokens.accessToken;
  } catch {
    clearAuth();
    return null;
  }
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; data: T; status: number }> {
  const auth = getStoredAuth();
  const headers = new Headers(options.headers);

  if (auth?.tokens.accessToken) {
    headers.set("Authorization", `Bearer ${auth.tokens.accessToken}`);
  }

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res = await fetch(path, { ...options, headers });

  if (res.status === 401 && auth?.tokens.refreshToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      res = await fetch(path, { ...options, headers });
    }
  }

  const data = res.headers.get("content-type")?.includes("application/json")
    ? await res.json()
    : (null as T);

  return { ok: res.ok, data: data as T, status: res.status };
}
