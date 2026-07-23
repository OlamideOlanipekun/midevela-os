import { seedAdminRolesAndPermissions, seedSuperAdmin } from "@/server/admin/rbac";

export async function seedAdminSystem(email: string, password: string, name: string) {
  await seedAdminRolesAndPermissions();
  await seedSuperAdmin(email, password, name);
  return { success: true };
}
