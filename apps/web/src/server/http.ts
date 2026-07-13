import { NextResponse } from "next/server";
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
 * Wraps a route handler body: known ApiErrors map to their status,
 * anything else logs and returns a generic 500.
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
    // Unexpected error = a real bug worth surfacing, not just logging.
    await alert("Unhandled API error (500)", {
      error: err instanceof Error ? err.message : String(err),
    });
    return jsonError(500, "Internal server error");
  }
}
