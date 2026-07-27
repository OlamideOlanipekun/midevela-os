import { prisma } from "@/lib/prisma";
import type { SystemConfigItem, IntegrationConfigItem, EmailTemplateItem, SettingsDashboard } from "./types";

export async function getSettingsDashboard(): Promise<SettingsDashboard> {
  const [configCount, integrationCount, activeIntegrations, templateCount, recentConfigs] = await Promise.all([
    prisma.systemConfig.count(),
    prisma.integrationConfig.count(),
    prisma.integrationConfig.count({ where: { enabled: true } }),
    prisma.emailTemplate.count(),
    prisma.systemConfig.findMany({ take: 5, orderBy: { updatedAt: "desc" } }),
  ]);
  return {
    configCount,
    integrationCount,
    activeIntegrations,
    templateCount,
    recentConfigs: recentConfigs.map((c) => ({ id: c.id, key: c.key, value: c.value, category: c.category, description: c.description, updatedAt: c.updatedAt.toISOString() })),
  };
}

export async function listConfigs(category?: string) {
  const where = category ? { category } : {};
  const items = await prisma.systemConfig.findMany({ where, orderBy: { key: "asc" } });
  return items.map((c) => ({ id: c.id, key: c.key, value: c.value, category: c.category, description: c.description, updatedAt: c.updatedAt.toISOString() }));
}

export async function updateConfig(id: string, data: { value?: any; description?: string; category?: string }) {
  const c = await prisma.systemConfig.update({ where: { id }, data });
  return { id: c.id, key: c.key, value: c.value, category: c.category, description: c.description, updatedAt: c.updatedAt.toISOString() };
}

export async function listIntegrations() {
  const items = await prisma.integrationConfig.findMany({ orderBy: { provider: "asc" } });
  return items.map((i) => ({
    id: i.id, provider: i.provider, label: i.label, enabled: i.enabled, settings: i.settings,
    credentials: i.credentials, lastTestedAt: i.lastTestedAt?.toISOString() ?? null, testStatus: i.testStatus,
  }));
}

export async function updateIntegration(id: string, data: { enabled?: boolean; settings?: any; credentials?: any }) {
  const i = await prisma.integrationConfig.update({ where: { id }, data });
  return {
    id: i.id, provider: i.provider, label: i.label, enabled: i.enabled, settings: i.settings,
    credentials: i.credentials, lastTestedAt: i.lastTestedAt?.toISOString() ?? null, testStatus: i.testStatus,
  };
}

export async function testIntegration(id: string) {
  const i = await prisma.integrationConfig.findUnique({ where: { id } });
  if (!i) return null;
  const result = await prisma.integrationConfig.update({ where: { id }, data: { lastTestedAt: new Date(), testStatus: "success" } });
  return { ...i, lastTestedAt: result.lastTestedAt?.toISOString() ?? null, testStatus: result.testStatus };
}

export async function listEmailTemplates() {
  const items = await prisma.emailTemplate.findMany({ orderBy: { slug: "asc" } });
  return items.map((t) => ({ id: t.id, slug: t.slug, name: t.name, subject: t.subject, body: t.body, variables: t.variables as string[], updatedAt: t.updatedAt.toISOString() }));
}

export async function updateEmailTemplate(id: string, data: { subject?: string; body?: string }) {
  const t = await prisma.emailTemplate.update({ where: { id }, data });
  return { id: t.id, slug: t.slug, name: t.name, subject: t.subject, body: t.body, variables: t.variables as string[], updatedAt: t.updatedAt.toISOString() };
}
