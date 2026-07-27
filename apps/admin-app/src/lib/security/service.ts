import { prisma } from "@/lib/prisma";
import type { HardeningDashboard } from "./types";

export async function getHardeningDashboard(): Promise<HardeningDashboard> {
  const [totalApiKeys, activeApiKeys, blockedIps, rateLimitOverrides, recentApiKeys, ipRules] = await Promise.all([
    prisma.apiKey.count(),
    prisma.apiKey.count({ where: { active: true } }),
    prisma.ipRule.count({ where: { action: "BLOCK" } }),
    prisma.rateLimitOverride.count(),
    prisma.apiKey.findMany({ take: 5, orderBy: { createdAt: "desc" } }),
    prisma.ipRule.findMany({ take: 10, orderBy: { createdAt: "desc" } }),
  ]);
  return {
    totalApiKeys,
    activeApiKeys,
    blockedIps,
    rateLimitOverrides,
    recentApiKeys: recentApiKeys.map((k) => ({ ...k, scopes: k.scopes as string[], lastUsedAt: k.lastUsedAt?.toISOString() ?? null, expiresAt: k.expiresAt?.toISOString() ?? null, createdAt: k.createdAt.toISOString(), revokedAt: k.revokedAt?.toISOString() ?? null })),
    ipRules: ipRules.map((r) => ({ ...r, expiresAt: r.expiresAt?.toISOString() ?? null })),
  };
}

export async function listApiKeys(activeOnly?: boolean) {
  const where = activeOnly ? { active: true } : {};
  const keys = await prisma.apiKey.findMany({ where, orderBy: { createdAt: "desc" } });
  return keys.map((k) => ({ ...k, scopes: k.scopes as string[], lastUsedAt: k.lastUsedAt?.toISOString() ?? null, expiresAt: k.expiresAt?.toISOString() ?? null, createdAt: k.createdAt.toISOString(), revokedAt: k.revokedAt?.toISOString() ?? null }));
}

export async function revokeApiKey(id: string) {
  const k = await prisma.apiKey.update({ where: { id }, data: { active: false, revokedAt: new Date() } });
  return { ...k, scopes: k.scopes as string[], lastUsedAt: k.lastUsedAt?.toISOString() ?? null, expiresAt: k.expiresAt?.toISOString() ?? null, createdAt: k.createdAt.toISOString(), revokedAt: k.revokedAt?.toISOString() ?? null };
}

export async function listIpRules() {
  const rules = await prisma.ipRule.findMany({ orderBy: { createdAt: "desc" } });
  return rules.map((r) => ({ ...r, expiresAt: r.expiresAt?.toISOString() ?? null }));
}

export async function deleteIpRule(id: string) {
  await prisma.ipRule.delete({ where: { id } });
}

export async function listRateLimits() {
  return prisma.rateLimitOverride.findMany({ orderBy: { route: "asc" } });
}
