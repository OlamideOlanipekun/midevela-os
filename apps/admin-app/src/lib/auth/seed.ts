import { prisma } from "@/lib/prisma";
import { hashPassword } from "./password";

const PERMISSION_DEFS = [
  { name: "merchant.read", module: "merchants", description: "View merchant list and details" },
  { name: "merchant.create", module: "merchants", description: "Create new merchants" },
  { name: "merchant.update", module: "merchants", description: "Edit merchant settings" },
  { name: "merchant.delete", module: "merchants", description: "Delete merchants" },
  { name: "merchant.suspend", module: "merchants", description: "Suspend/unsuspend merchants" },
  { name: "merchant.impersonate", module: "merchants", description: "Login as merchant" },
  { name: "website.read", module: "website", description: "View website registry" },
  { name: "website.delete", module: "website", description: "Delete websites" },
  { name: "billing.read", module: "billing", description: "View billing data" },
  { name: "billing.update", module: "billing", description: "Modify billing" },
  { name: "conversations.read", module: "conversations", description: "View conversations" },
  { name: "conversations.write", module: "conversations", description: "Intervene in conversations" },
  { name: "ai_agents.read", module: "ai_agents", description: "View AI agent metrics" },
  { name: "ai_agents.write", module: "ai_agents", description: "Edit AI agent config" },
  { name: "analytics.read", module: "analytics", description: "View analytics" },
  { name: "support.read", module: "support", description: "View support tickets" },
  { name: "support.write", module: "support", description: "Respond to tickets" },
  { name: "feature_flags.read", module: "feature_flags", description: "View feature flags" },
  { name: "feature_flags.write", module: "feature_flags", description: "Toggle feature flags" },
  { name: "audit_logs.read", module: "audit_logs", description: "View audit logs" },
  { name: "admin_users.read", module: "admin_users", description: "View admin users" },
  { name: "admin_users.write", module: "admin_users", description: "Create/edit admin users" },
  { name: "knowledge.read", module: "knowledge", description: "View knowledge entries" },
  { name: "knowledge.write", module: "knowledge", description: "Manage knowledge entries" },
  { name: "products.read", module: "products", description: "View products" },
  { name: "products.write", module: "products", description: "Manage products" },
  { name: "notifications.read", module: "notifications", description: "View notifications" },
  { name: "notifications.write", module: "notifications", description: "Send notifications" },
  { name: "infrastructure.read", module: "infrastructure", description: "View infrastructure status" },
  { name: "dashboard.read", module: "dashboard", description: "View Mission Control dashboard" },
  { name: "settings.read", module: "settings", description: "View admin settings" },
  { name: "settings.write", module: "settings", description: "Modify admin settings" },
];

const ROLE_DEFS: Record<string, string[]> = {
  SUPER_ADMIN: PERMISSION_DEFS.map((p) => p.name),
  OPERATIONS: [
    "dashboard.read", "merchant.read", "merchant.create", "merchant.update", "merchant.suspend",
    "conversations.read", "billing.read", "analytics.read",
    "support.read", "support.write", "notifications.read",
  ],
  SUPPORT: [
    "dashboard.read", "merchant.read", "conversations.read", "conversations.write",
    "support.read", "support.write", "notifications.read",
  ],
  DEVELOPER: [
    "dashboard.read", "merchant.read",
    "ai_agents.read", "ai_agents.write",
    "conversations.read", "feature_flags.read", "feature_flags.write",
    "audit_logs.read", "infrastructure.read",
    "knowledge.read", "knowledge.write", "products.read", "products.write",
  ],
  FINANCE: [
    "dashboard.read", "merchant.read", "billing.read", "billing.update",
    "analytics.read", "audit_logs.read",
  ],
  MODERATOR: [
    "dashboard.read", "merchant.read", "conversations.read", "conversations.write",
    "support.read", "support.write",
  ],
  READ_ONLY: [
    "dashboard.read", "merchant.read", "conversations.read", "billing.read",
    "analytics.read", "support.read", "audit_logs.read",
  ],
};

export async function seedRolesAndPermissions(): Promise<void> {
  for (const def of PERMISSION_DEFS) {
    await prisma.adminPermission.upsert({
      where: { name: def.name },
      update: { description: def.description },
      create: def,
    });
  }

  for (const [roleName, permNames] of Object.entries(ROLE_DEFS)) {
    const role = await prisma.adminRole.upsert({
      where: { name: roleName as any },
      update: {},
      create: { name: roleName as any, isSystem: true, description: `${roleName.replace("_", " ")} role` },
    });

    for (const permName of permNames) {
      const permission = await prisma.adminPermission.findUnique({ where: { name: permName } });
      if (permission) {
        await prisma.adminRolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          update: {},
          create: { roleId: role.id, permissionId: permission.id },
        });
      }
    }
  }
}

export async function seedSuperAdmin(email: string, password: string, firstName: string): Promise<void> {
  const existing = await prisma.admin.findFirst();
  if (existing) return;

  const role = await prisma.adminRole.findUnique({ where: { name: "SUPER_ADMIN" } });
  if (!role) throw new Error("SUPER_ADMIN role not found. Run seedRolesAndPermissions first.");

  const hashed = await hashPassword(password);

  const admin = await prisma.admin.create({
    data: { email, passwordHash: hashed, firstName },
  });

  await prisma.adminAdminRole.create({
    data: { adminId: admin.id, roleId: role.id },
  });
}
