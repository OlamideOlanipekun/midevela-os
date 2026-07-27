import { NextRequest, NextResponse } from "next/server";
import { alert } from "@/server/observability/notify";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * CSRF guard: reject state-changing requests from unrecognised origins.
 * Works with SameSite=Lax cookies to block cross-origin form attacks.
 */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isMutating(method: string): boolean {
  return MUTATING_METHODS.has(method);
}

export function assertOrigin(req: NextRequest): void {
  if (!isMutating(req.method)) return;
  let origin = req.headers.get("origin");
  if (!origin) {
    const referer = req.headers.get("referer");
    if (referer) {
      try {
        origin = new URL(referer).origin;
      } catch {
        // invalid referer header
      }
    }
  }
  if (!origin) return; // same-origin requests from simple forms or browsers may omit Origin/Referer in edge cases

  const host = req.headers.get("host");
  try {
    const u = new URL(origin);
    if (u.host === host) return;
    // Also accept localhost in dev
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return;
  } catch {
    // unparseable origin — reject
  }
  throw new ApiError(403, "CSRF: cross-origin request rejected");
}

/**
 * Wraps a route handler body: known ApiErrors map to their status,
 * anything else logs and returns a generic 500.
 *
 * Returns a Promise<NextResponse> — call via `return withErrorHandling(...)`
 * inside an exported async GET/POST handler. Option to pass `req` to automatically enforce `assertOrigin(req)`.
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  req?: NextRequest
): Promise<T | NextResponse> {
  try {
    if (req) assertOrigin(req);
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      return jsonError(err.status, err.message);
    }
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[API 500 Error]", msg, stack);
    if (process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV !== "production") {
      return jsonError(500, `Internal server error: ${msg}`);
    }
    return jsonError(500, "Internal server error");
  }
}

/**
 * Route handler that takes (req, context) — used by admin API routes.
 * Export the result directly: `export const GET = withAdminHandler(...)`
 */
export type AdminRouteHandler<T = unknown> = (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => Promise<T>;

export function withAdminHandler<T>(
  fn: AdminRouteHandler<T>
): AdminRouteHandler<T | NextResponse> {
  return async (req, context) => {
    try {
      assertOrigin(req);
      return await fn(req, context);
    } catch (err) {
      if (err instanceof ApiError) {
        return jsonError(err.status, err.message);
      }
      await alert("Unhandled API error (500)", {
        error: err instanceof Error ? err.message : String(err),
      });
      return jsonError(500, "Internal server error");
    }
  };
}

