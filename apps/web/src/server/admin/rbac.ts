import type { AdminUser, AdminRole, AdminPermission } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError } from "@/server/http";
import { hashPassword } from "@/server/auth/password";

interface AdminWithPermissions extends AdminUser {
  role: (AdminRole & { permissions: { permission: AdminPermission }[] }) | null;
}

type PermissionCheck = { module: string; action: string };

/**
 * Checks whether the admin has a specific permission via their role.
 * Returns true/false — does not throw.
 */
export async function hasPermission(
  admin: AdminWithPermissions,
  check: PermissionCheck
): Promise<boolean> {
  if (!admin.role) return false;
  const { module, action } = check;

  // super_admin has all permissions implicitly
  if (admin.role.name === "SUPER_ADMIN") return true;

  return admin.role.permissions.some(
    (rp) => rp.permission.module === module && rp.permission.action === action
  );
}

/**
 * Requires the admin to have a specific permission. Throws 403 if not.
 */
export async function requirePermission(
  admin: AdminUser,
  check: PermissionCheck
): Promise<void> {
  const full = await prisma.adminUser.findUnique({
    where: { id: admin.id },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });

  if (!full) throw new ApiError(401, "Admin not found");
  if (!full.role) throw new ApiError(403, "No role assigned");

  if (full.role.name === "SUPER_ADMIN") return;

  const has = full.role.permissions.some(
    (rp) => rp.permission.module === check.module && rp.permission.action === check.action
  );

  if (!has) {
    throw new ApiError(403, `Permission denied: ${check.module}.${check.action}`);
  }
}

/**
 * Seeds default roles and permissions. Call during initial setup.
 */
export async function seedAdminRolesAndPermissions(): Promise<void> {
  const permissionDefs = [
    { module: "dashboard", action: "read", description: "View Mission Control dashboard" },
    { module: "merchants", action: "read", description: "View merchant list and details" },
    { module: "merchants", action: "write", description: "Edit merchant settings" },
    { module: "merchants", action: "delete", description: "Delete merchants" },
    { module: "merchants", action: "suspend", description: "Suspend/unsuspend merchants" },
    { module: "merchants", action: "impersonate", description: "Login as merchant" },
    { module: "ai_agents", action: "read", description: "View AI agent metrics" },
    { module: "ai_agents", action: "write", description: "Edit AI agent configuration" },
    { module: "conversations", action: "read", description: "View live conversations" },
    { module: "conversations", action: "write", description: "Intervene in conversations" },
    { module: "billing", action: "read", description: "View billing and subscription data" },
    { module: "billing", action: "write", description: "Modify subscription and billing" },
    { module: "analytics", action: "read", description: "View analytics" },
    { module: "support", action: "read", description: "View support tickets" },
    { module: "support", action: "write", description: "Respond to support tickets" },
    { module: "feature_flags", action: "read", description: "View feature flags" },
    { module: "feature_flags", action: "write", description: "Toggle feature flags" },
    { module: "audit_logs", action: "read", description: "View audit logs" },
    { module: "admin_users", action: "read", description: "View admin users" },
    { module: "admin_users", action: "write", description: "Create/edit admin users" },
    { module: "infrastructure", action: "read", description: "View infrastructure status" },
    { module: "knowledge", action: "read", description: "View knowledge entries" },
    { module: "knowledge", action: "write", description: "Manage knowledge entries" },
    { module: "products", action: "read", description: "View products" },
    { module: "products", action: "write", description: "Manage products" },
    { module: "notifications", action: "read", description: "View notifications" },
    { module: "notifications", action: "write", description: "Send notifications" },
  ];

  const roles = {
    SUPER_ADMIN: permissionDefs.map((p) => `${p.module}.${p.action}`),
    OPERATIONS: [
      "dashboard.read", "merchants.read", "merchants.write", "merchants.suspend",
      "conversations.read", "billing.read", "analytics.read",
      "support.read", "support.write", "notifications.read",
    ],
    SUPPORT: [
      "dashboard.read", "merchants.read", "conversations.read", "conversations.write",
      "support.read", "support.write", "notifications.read",
    ],
    DEVELOPER: [
      "dashboard.read", "merchants.read", "ai_agents.read", "ai_agents.write",
      "conversations.read", "feature_flags.read", "feature_flags.write",
      "audit_logs.read", "infrastructure.read",
      "knowledge.read", "knowledge.write", "products.read", "products.write",
    ],
    FINANCE: [
      "dashboard.read", "merchants.read", "billing.read", "billing.write",
      "analytics.read", "audit_logs.read",
    ],
    MODERATOR: [
      "dashboard.read", "merchants.read", "conversations.read", "conversations.write",
      "support.read", "support.write",
    ],
    READ_ONLY: [
      "dashboard.read", "merchants.read", "conversations.read", "billing.read",
      "analytics.read", "support.read", "audit_logs.read",
    ],
  };

  for (const def of permissionDefs) {
    await prisma.adminPermission.upsert({
      where: { module_action: { module: def.module, action: def.action } },
      update: { description: def.description },
      create: def,
    });
  }

  for (const [roleName, perms] of Object.entries(roles)) {
    const role = await prisma.adminRole.upsert({
      where: { name: roleName as any },
      update: {},
      create: { name: roleName as any, isSystem: true, description: `${roleName.replace("_", " ")} role` },
    });

    for (const permKey of perms) {
      const [module, action] = permKey.split(".");
      const permission = await prisma.adminPermission.findUnique({
        where: { module_action: { module, action } },
      });
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

/**
 * Creates the initial super admin user. Only works if no admin exists yet.
 */
export async function seedSuperAdmin(email: string, password: string, name: string): Promise<void> {
  const existing = await prisma.adminUser.findFirst();
  if (existing) return;

  const role = await prisma.adminRole.findUnique({ where: { name: "SUPER_ADMIN" } });
  if (!role) throw new ApiError(500, "Super admin role not found. Run seedAdminRolesAndPermissions first.");

  const hashed = await hashPassword(password);

  await prisma.adminUser.create({
    data: { email, passwordHash: hashed, name, roleId: role.id, emailVerified: true },
  });
}
