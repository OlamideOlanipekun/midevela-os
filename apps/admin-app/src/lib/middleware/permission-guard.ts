import type { AccessTokenPayload } from "@/lib/auth/jwt";
import { AdminAuthError } from "./admin-guard";

export function requirePermission(admin: AccessTokenPayload, ...required: string[]): void {
  // SUPER_ADMIN has all permissions implicitly
  if (admin.roles.includes("SUPER_ADMIN")) return;

  for (const perm of required) {
    if (!admin.permissions.includes(perm)) {
      throw new AdminAuthError(403, `Permission denied: ${perm}`);
    }
  }
}
