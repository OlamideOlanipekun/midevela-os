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
  const origin = req.headers.get("origin");
  if (!origin) return; // same-origin requests from browsers omit Origin for simple GET; POST always sends it
  const host = req.headers.get("host");
  // Accept any origin that matches the app host (handles http vs https, port differences)
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
 * inside an exported async GET/POST handler.
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>
): Promise<T | NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      return jsonError(err.status, err.message);
    }
    await alert("Unhandled API error (500)", {
      error: err instanceof Error ? err.message : String(err),
    });
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
