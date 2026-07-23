import prisma from "@/lib/prisma";
import { ApiError } from "@/server/http";
import { logAudit } from "@/server/admin/audit";

interface MerchantListOrg {
  id: string;
  name: string;
  slug: string;
  websiteUrl: string | null;
  industry: string | null;
  country: string;
  currency: string;
  logoUrl: string | null;
  createdAt: Date;
  subscription: { status: string; plan: { code: string; name: string }; currentPeriodEnd: Date | null } | null;
  users: { id: string; name: string; email: string; role: string }[];
  _count: { products: number; conversations: number; customers: number; knowledgeEntries: number };
}

export async function listMerchants(options: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  plan?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const { limit = 50, offset = 0, search, status, plan, sortBy = "createdAt", sortDir = "desc" } = options;

  const where: any = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
      { users: { some: { email: { contains: search, mode: "insensitive" } } } },
    ];
  }

  if (status) {
    where.subscription = { status: status as any };
  }

  if (plan) {
    where.subscription = { ...where.subscription, plan: { code: plan } };
  }

  const [rows, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      include: {
        users: { select: { id: true, name: true, email: true, role: true }, take: 1 },
        subscription: { include: { plan: true } },
        _count: { select: { products: true, conversations: true, customers: true, knowledgeEntries: true } },
      },
      orderBy: { [sortBy]: sortDir },
      take: limit,
      skip: offset,
    }) as Promise<MerchantListOrg[]>,
    prisma.organization.count({ where }),
  ]);

  const items = rows.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    websiteUrl: org.websiteUrl,
    industry: org.industry,
    country: org.country,
    currency: org.currency,
    logoUrl: org.logoUrl,
    createdAt: org.createdAt,
    subscription: org.subscription
      ? {
          status: org.subscription.status,
          plan: org.subscription.plan.code,
          planName: org.subscription.plan.name,
          currentPeriodEnd: org.subscription.currentPeriodEnd,
        }
      : null,
    owner: org.users[0] || null,
    stats: {
      products: org._count.products,
      conversations: org._count.conversations,
      customers: org._count.customers,
      knowledgeEntries: org._count.knowledgeEntries,
    },
  }));

  return { items, total };
}

export async function getMerchant(id: string) {
  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      users: { select: { id: true, name: true, email: true, role: true, createdAt: true } },
      subscription: { include: { plan: true } },
      usageRecords: { take: 12, orderBy: { period: "desc" } },
      _count: { select: { products: true, conversations: true, customers: true, knowledgeEntries: true, categories: true } },
    },
  });

  if (!org) throw new ApiError(404, "Merchant not found");

  const u = org as any;

  return {
    id: u.id,
    name: u.name,
    slug: u.slug,
    websiteUrl: u.websiteUrl,
    industry: u.industry,
    country: u.country,
    currency: u.currency,
    logoUrl: u.logoUrl,
    settings: u.settings,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    users: u.users,
    subscription: u.subscription
      ? {
          id: u.subscription.id,
          status: u.subscription.status,
          plan: u.subscription.plan.code,
          planName: u.subscription.plan.name,
          trialEndsAt: u.subscription.trialEndsAt,
          currentPeriodEnd: u.subscription.currentPeriodEnd,
        }
      : null,
    usage: u.usageRecords,
    stats: {
      products: u._count.products,
      conversations: u._count.conversations,
      customers: u._count.customers,
      knowledgeEntries: u._count.knowledgeEntries,
      categories: u._count.categories,
    },
  };
}

export async function suspendMerchant(adminId: string, orgId: string, reason?: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new ApiError(404, "Merchant not found");

  const subscription = await prisma.subscription.findUnique({ where: { orgId } });

  if (subscription) {
    await prisma.subscription.update({
      where: { orgId },
      data: { status: "CANCELLED" },
    });
  }

  await logAudit(adminId, "merchant.suspend", "organization", orgId, { reason });

  return { success: true };
}

export async function unsuspendMerchant(adminId: string, orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new ApiError(404, "Merchant not found");

  const subscription = await prisma.subscription.findUnique({ where: { orgId } });

  if (subscription) {
    await prisma.subscription.update({
      where: { orgId },
      data: { status: "ACTIVE" },
    });
  }

  await logAudit(adminId, "merchant.unsuspend", "organization", orgId);

  return { success: true };
}

export async function deleteMerchant(adminId: string, orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new ApiError(404, "Merchant not found");

  await prisma.organization.delete({ where: { id: orgId } });

  await logAudit(adminId, "merchant.delete", "organization", orgId);

  return { success: true };
}

export async function updateMerchantPlan(adminId: string, orgId: string, planCode: string) {
  const plan = await prisma.plan.findUnique({ where: { code: planCode } });
  if (!plan) throw new ApiError(404, "Plan not found");

  const subscription = await prisma.subscription.upsert({
    where: { orgId },
    update: { planId: plan.id },
    create: { orgId, planId: plan.id, status: "ACTIVE" },
  });

  await logAudit(adminId, "merchant.update_plan", "subscription", subscription.id, { planCode });

  return { success: true, subscription };
}

export async function getMerchantActivity(orgId: string, limit = 20) {
  return prisma.auditLog.findMany({
    where: { resource: "organization", resourceId: orgId },
    include: { admin: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
