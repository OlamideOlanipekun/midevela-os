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

export type RouteHandler<T = unknown> = (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => Promise<T>;

/**
 * Wraps a route handler body: known ApiErrors map to their status,
 * anything else logs and returns a generic 500.
 */
export function withErrorHandling<T>(
  fn: RouteHandler<T>
): RouteHandler<T | NextResponse> {
  return async (req, context) => {
    try {
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
