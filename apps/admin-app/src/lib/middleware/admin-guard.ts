import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAccessToken, type AccessTokenPayload } from "@/lib/auth/jwt";

export interface AdminRequest extends NextRequest {
  admin: AccessTokenPayload;
}

export function requireAdmin(req: NextRequest): AccessTokenPayload {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AdminAuthError(401, "Missing or invalid authorization header");
  }

  const token = authHeader.slice(7);
  try {
    return verifyAccessToken(token);
  } catch {
    throw new AdminAuthError(401, "Invalid or expired access token");
  }
}

export class AdminAuthError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function withAdminGuard<T>(
  handler: (req: AdminRequest, context: { params: Promise<Record<string, string>> }) => Promise<T>
): (req: NextRequest, context: { params: Promise<Record<string, string>> }) => Promise<T | NextResponse> {
  return async (req, context) => {
    try {
      const payload = requireAdmin(req);
      (req as AdminRequest).admin = payload;
      return await handler(req as AdminRequest, context);
    } catch (err) {
      if (err instanceof AdminAuthError) {
        return jsonError(err.status, err.message);
      }
      return jsonError(500, "Internal server error");
    }
  };
}
