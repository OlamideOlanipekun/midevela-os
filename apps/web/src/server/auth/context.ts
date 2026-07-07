import { auth, currentUser } from "@clerk/nextjs/server";
import type { Organization, User } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError } from "@/server/http";

export interface OrgContext {
  user: User;
  org: Organization;
}

/**
 * Resolves the Clerk session to a local User row, creating it on first
 * authenticated request (webhook sync is the primary path; this is the
 * fallback so a missed webhook never locks a user out).
 * Throws ApiError(401) when unauthenticated.
 */
export async function requireUser(): Promise<User> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    throw new ApiError(401, "Unauthorized");
  }

  const existing = await prisma.user.findUnique({ where: { clerkUserId } });
  if (existing) return existing;

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress;
  if (!email) {
    throw new ApiError(401, "Unauthorized");
  }

  return prisma.user.upsert({
    where: { email },
    update: { clerkUserId },
    create: {
      clerkUserId,
      email,
      name:
        [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
        email.split("@")[0],
      avatarUrl: clerkUser?.imageUrl ?? null,
      role: "OWNER",
    },
  });
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
