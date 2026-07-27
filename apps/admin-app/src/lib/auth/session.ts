import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "./jwt";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateJti(): string {
  return randomBytes(16).toString("hex");
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AdminSessionInfo {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  avatar: string | null;
  roles: string[];
  permissions: string[];
}

async function getAdminWithRoles(adminId: string): Promise<AdminSessionInfo | null> {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });
  if (!admin || !admin.isActive) return null;

  const roles = admin.roles.map((ar) => ar.role.name);
  const permissionSet = new Set<string>();
  for (const ar of admin.roles) {
    for (const rp of ar.role.permissions) {
      permissionSet.add(rp.permission.name);
    }
  }

  return {
    id: admin.id,
    firstName: admin.firstName,
    lastName: admin.lastName,
    email: admin.email,
    avatar: admin.avatar,
    roles,
    permissions: Array.from(permissionSet),
  };
}

export async function createSession(
  adminId: string,
  ipAddress?: string,
  device?: string,
  browser?: string
): Promise<{ pair: TokenPair; session: AdminSessionInfo } | null> {
  const sessionInfo = await getAdminWithRoles(adminId);
  if (!sessionInfo) return null;

  const jti = generateJti();
  const refreshToken = signRefreshToken({ sub: adminId, jti });
  const refreshTokenHash = hashToken(refreshToken);

  const refreshExpiryMs = 30 * 24 * 60 * 60 * 1000;

  await prisma.adminSession.create({
    data: {
      adminId,
      refreshTokenHash,
      ipAddress,
      device,
      browser,
      expiresAt: new Date(Date.now() + refreshExpiryMs),
    },
  });

  const accessToken = signAccessToken({
    sub: adminId,
    email: sessionInfo.email,
    roles: sessionInfo.roles,
    permissions: sessionInfo.permissions,
  });

  return { pair: { accessToken, refreshToken }, session: sessionInfo };
}

export async function refreshSession(
  oldRefreshToken: string,
  ipAddress?: string,
  device?: string,
  browser?: string
): Promise<{ pair: TokenPair; session: AdminSessionInfo } | null> {
  let payload;
  try {
    payload = verifyRefreshToken(oldRefreshToken);
  } catch {
    return null;
  }

  const oldHash = hashToken(oldRefreshToken);
  const existing = await prisma.adminSession.findUnique({
    where: { refreshTokenHash: oldHash },
  });

  if (!existing) return null;
  if (existing.expiresAt < new Date()) {
    await prisma.adminSession.delete({ where: { id: existing.id } }).catch(() => undefined);
    return null;
  }

  await prisma.adminSession.delete({ where: { id: existing.id } }).catch(() => undefined);

  const sessionInfo = await getAdminWithRoles(payload.sub);
  if (!sessionInfo) return null;

  const jti = generateJti();
  const newRefreshToken = signRefreshToken({ sub: payload.sub, jti });
  const newHash = hashToken(newRefreshToken);
  const refreshExpiryMs = 30 * 24 * 60 * 60 * 1000;

  await prisma.adminSession.create({
    data: {
      adminId: payload.sub,
      refreshTokenHash: newHash,
      ipAddress,
      device,
      browser,
      expiresAt: new Date(Date.now() + refreshExpiryMs),
    },
  });

  const accessToken = signAccessToken({
    sub: payload.sub,
    email: sessionInfo.email,
    roles: sessionInfo.roles,
    permissions: sessionInfo.permissions,
  });

  return { pair: { accessToken, refreshToken: newRefreshToken }, session: sessionInfo };
}

export async function revokeSession(refreshToken: string): Promise<void> {
  const hash = hashToken(refreshToken);
  await prisma.adminSession.deleteMany({ where: { refreshTokenHash: hash } }).catch(() => undefined);
}

export async function revokeAllSessions(adminId: string): Promise<void> {
  await prisma.adminSession.deleteMany({ where: { adminId } }).catch(() => undefined);
}
