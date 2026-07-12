import type { Organization, User } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError } from "@/server/http";
import { getSessionUser } from "@/server/auth/session";
import { getSubscriptionForOrg, accessLevelFor } from "@/server/billing/subscription";

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

/**
 * requireOrg plus a subscription check: the org must be allowed to make
 * changes. Use this on every mutating/AI route so billing enforcement is
 * a real server-side boundary, not just the dashboard's redirect.
 *
 *   locked    → 402, no access
 *   read_only → 402, reads still work via requireOrg but writes are blocked
 *
 * 402 Payment Required is used deliberately so the client can distinguish
 * a billing block from a 401 (auth) or 403 (onboarding/ownership).
 */
export async function requireActiveOrg(): Promise<OrgContext> {
  const ctx = await requireOrg();
  const subscription = await getSubscriptionForOrg(ctx.org.id);
  const level = accessLevelFor(subscription.status);
  if (level === "locked") {
    throw new ApiError(402, "Your subscription is inactive. Please renew to continue.");
  }
  if (level === "read_only") {
    throw new ApiError(402, "Read-only mode: your payment is past due. Please update billing.");
  }
  return ctx;
}
