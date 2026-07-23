import { randomBytes, createHash } from "crypto";
import { cookies } from "next/headers";
import type { AdminUser } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ApiError } from "@/server/http";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { logAudit } from "@/server/admin/audit";

const SESSION_COOKIE = "midevela_admin_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAdminSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.adminSession.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    expires: expiresAt,
  });
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.adminSession
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => undefined);
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getAdminSessionUser(): Promise<AdminUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  return session.user;
}

export async function requireAdmin(): Promise<AdminUser> {
  const user = await getAdminSessionUser();
  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }
  return user;
}

export async function loginAsAdmin(email: string, password: string, ipAddress?: string): Promise<AdminUser> {
  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (!user) {
    // Constant-time dummy verification to prevent email enumeration
    await verifyPassword(password, "3267900d63056eb9e7322c93d51caed9:602c204da61a3e13c23febddf580123e7a261992131efa9f78ea0adc84dfd9fec6a4e2d351820ccd52fa0b56a404eb42420d66f5ddab4213481e593e61b6f5cf");
    throw new ApiError(401, "Invalid email or password");
  }

  if (!user.isActive) {
    throw new ApiError(403, "Account is deactivated");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, "Invalid email or password");
  }

  await createAdminSession(user.id);
  await prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await logAudit(user.id, "admin.login", "admin_user", user.id, { ip: ipAddress });

  return user;
}

export async function logoutAdmin(): Promise<void> {
  const user = await getAdminSessionUser();
  if (user) {
    await logAudit(user.id, "admin.logout", "admin_user", user.id);
  }
  await destroyAdminSession();
}
