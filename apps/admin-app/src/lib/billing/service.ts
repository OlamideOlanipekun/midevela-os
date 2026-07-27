import { prisma } from "@/lib/prisma";
import type { BillingDashboard, PlanItem, SubscriptionItem, InvoiceItem, PaymentItem, RefundItem, CouponItem, EnterpriseAccountItem } from "./types";

export async function getBillingDashboard(): Promise<BillingDashboard> {
  const [monthRevenue, activePlans, trials, enterprise, failedPayments, overdueInvoices] = await Promise.all([
    prisma.payment.aggregate({ where: { status: "SUCCEEDED", createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } }, _sum: { amount: true } }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.count({ where: { status: "TRIALING" } }),
    prisma.enterpriseAccount.count(),
    prisma.payment.count({ where: { status: "FAILED" } }),
    prisma.invoice.count({ where: { status: "OVERDUE" } }),
  ]);
  const mrr = Number(monthRevenue._sum.amount || 0);
  return { mrr, arr: mrr * 12, activePlans, trials, enterprise, failedPayments, outstandingInvoices: overdueInvoices };
}

export async function listPlans(): Promise<PlanItem[]> {
  const plans = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });
  return plans.map((p) => ({ ...p, priceMonthly: Number(p.priceMonthly), priceYearly: p.priceYearly ? Number(p.priceYearly) : null, features: p.features as string[], limits: p.limits as Record<string, unknown> })) as any;
}

export async function createPlan(data: { code: string; name: string; priceMonthly: number; description?: string; features?: string[]; limits?: Record<string, unknown> }) {
  return prisma.plan.create({ data: { code: data.code, name: data.name, priceMonthly: data.priceMonthly, description: data.description, features: data.features || [], limits: (data.limits || {}) as any } });
}

export async function updatePlan(id: string, data: { name?: string; priceMonthly?: number; active?: boolean; features?: string[]; limits?: Record<string, unknown> }) {
  return prisma.plan.update({ where: { id }, data: data as any });
}

export async function listSubscriptions(params: { status?: string; page: number; limit: number }): Promise<{ items: SubscriptionItem[]; total: number; page: number; totalPages: number }> {
  const { status, page, limit } = params;
  const skip = (page - 1) * limit;
  const where = status ? { status: status as any } : {};
  const [items, total] = await Promise.all([
    prisma.subscription.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit, include: { org: { select: { name: true } }, plan: { select: { name: true } } } }),
    prisma.subscription.count({ where }),
  ]);
  return {
    items: items.map((s) => ({ id: s.id, orgId: s.orgId, merchantName: s.org.name, planId: s.planId, planName: s.plan.name, status: s.status, trialEndsAt: s.trialEndsAt?.toISOString() || null, currentPeriodEnd: s.currentPeriodEnd?.toISOString() || null, createdAt: s.createdAt.toISOString() })) as any,
    total, page, totalPages: Math.ceil(total / limit),
  };
}

export async function updateSubscription(id: string, data: { status?: string; planId?: string }) {
  return prisma.subscription.update({ where: { id }, data: data as any });
}

export async function listInvoices(params: { orgId?: string; status?: string; page: number; limit: number }): Promise<{ items: InvoiceItem[]; total: number; page: number; totalPages: number }> {
  const { orgId, status, page, limit } = params;
  const skip = (page - 1) * limit;
  const AND: Record<string, unknown>[] = [];
  if (orgId) AND.push({ orgId });
  if (status) AND.push({ status });
  const where = AND.length > 0 ? { AND } : {};
  const [items, total] = await Promise.all([
    prisma.invoice.findMany({ where: where as any, orderBy: { createdAt: "desc" }, skip, take: limit, include: { org: { select: { name: true } } } }),
    prisma.invoice.count({ where: where as any }),
  ]);
  return {
    items: items.map((i) => ({ ...i, amount: Number(i.amount), tax: Number(i.tax), total: Number(i.total), merchantName: i.org?.name, periodStart: i.periodStart?.toISOString() || null, periodEnd: i.periodEnd?.toISOString() || null, dueDate: i.dueDate?.toISOString() || null, paidAt: i.paidAt?.toISOString() || null, createdAt: i.createdAt.toISOString() })) as any,
    total, page, totalPages: Math.ceil(total / limit),
  };
}

export async function listPayments(params: { orgId?: string; status?: string; page: number; limit: number }): Promise<{ items: PaymentItem[]; total: number; page: number; totalPages: number }> {
  const { orgId, status, page, limit } = params;
  const skip = (page - 1) * limit;
  const AND: Record<string, unknown>[] = [];
  if (orgId) AND.push({ orgId });
  if (status) AND.push({ status });
  const where = AND.length > 0 ? { AND } : {};
  const [items, total] = await Promise.all([
    prisma.payment.findMany({ where: where as any, orderBy: { createdAt: "desc" }, skip, take: limit, include: { org: { select: { name: true } } } }),
    prisma.payment.count({ where: where as any }),
  ]);
  return {
    items: items.map((p) => ({ ...p, amount: Number(p.amount), merchantName: p.org?.name, paidAt: p.paidAt?.toISOString() || null, createdAt: p.createdAt.toISOString() })) as any,
    total, page, totalPages: Math.ceil(total / limit),
  };
}

export async function listRefunds(params: { orgId?: string; page: number; limit: number }): Promise<{ items: RefundItem[]; total: number; page: number; totalPages: number }> {
  const { orgId, page, limit } = params;
  const skip = (page - 1) * limit;
  const where = orgId ? { orgId } : {};
  const [items, total] = await Promise.all([
    prisma.refund.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.refund.count({ where }),
  ]);
  return {
    items: items.map((r) => ({ ...r, amount: Number(r.amount), approvedAt: r.approvedAt?.toISOString() || null, createdAt: r.createdAt.toISOString() })) as any,
    total, page, totalPages: Math.ceil(total / limit),
  };
}

export async function approveRefund(id: string, adminId: string) {
  return prisma.refund.update({ where: { id }, data: { status: "approved", approvedBy: adminId, approvedAt: new Date() } });
}

export async function rejectRefund(id: string) {
  return prisma.refund.update({ where: { id }, data: { status: "rejected" } });
}

export async function listCoupons(): Promise<CouponItem[]> {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return coupons.map((c) => ({ ...c, discountValue: Number(c.discountValue), expiresAt: c.expiresAt?.toISOString() || null })) as any;
}

export async function createCoupon(data: { code: string; discountType: string; discountValue: number; description?: string; maxUses?: number; expiresAt?: string }) {
  return prisma.coupon.create({ data: { code: data.code, discountType: data.discountType, discountValue: data.discountValue, description: data.description, maxUses: data.maxUses, expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined } });
}

export async function listUsageRecords(orgId?: string): Promise<{ metric: string; value: number }[]> {
  const where = orgId ? { orgId } : {};
  const records = await prisma.usageRecord.groupBy({ by: ["metric"], where, _sum: { value: true }, orderBy: { _sum: { value: "desc" } } });
  return records.map((r) => ({ metric: r.metric, value: r._sum.value || 0 }));
}

export async function listEnterpriseAccounts(): Promise<EnterpriseAccountItem[]> {
  const accounts = await prisma.enterpriseAccount.findMany({ include: { org: { select: { name: true } }, plan: { select: { name: true } } } });
  return accounts.map((a) => ({ ...a, customPrice: a.customPrice ? Number(a.customPrice) : null, dedicatedLimits: a.dedicatedLimits as Record<string, unknown> })) as any;
}
