import type { UserRole } from "@prisma/client";
import prisma from "@/lib/prisma";

const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  AGENT: "Agent",
};

/**
 * There's no invite/multi-user-join flow yet — signup always creates a
 * standalone user, and onboarding always creates a brand-new org for
 * them as OWNER. So today every org genuinely has exactly one member.
 * This reflects that honestly rather than showing fabricated teammates;
 * it'll naturally show more members once an invite flow exists to add
 * them for real.
 */
export async function listTeamMembers(orgId: string) {
  const users = await prisma.user.findMany({
    where: { orgId },
    orderBy: { createdAt: "asc" },
  });
  return users.map((u) => ({
    name: u.name,
    email: u.email,
    role: ROLE_LABELS[u.role],
  }));
}
