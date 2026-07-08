import type { Organization, User } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError } from "@/server/http";
import { getSessionUser } from "@/server/auth/session";

export interface OrgContext {
  user: User;
  org: Organization;
}

/** Resolves the session cookie to a User row. Throws ApiError(401) when unauthenticated. */
export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }
  return user;
}

/**
 * Requires an authenticated user that belongs to an organization.
 * Throws ApiError(401) when unauthenticated, ApiError(403) when the
 * user has not completed onboarding (no org yet).
 *
 * Every tenant-scoped query MUST take its orgId from this context —
 * never from a request body or query string.
 */
export async function requireOrg(): Promise<OrgContext> {
  const user = await requireUser();
  if (!user.orgId) {
    throw new ApiError(403, "No organization. Complete onboarding first.");
  }
  const org = await prisma.organization.findUnique({
    where: { id: user.orgId },
  });
  if (!org) {
    throw new ApiError(403, "Organization not found.");
  }
  return { user, org };
}
