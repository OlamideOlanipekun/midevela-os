import { randomBytes, createHash } from "crypto";
import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import prisma from "@/lib/prisma";
import { SESSION_COOKIE } from "@/server/auth/constants";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SLIDING_REFRESH_THRESHOLD_MS = SESSION_TTL_MS / 2; // extend after 15 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a new session: random token stored (hashed) in the DB, raw
 * token set as an httpOnly cookie. DB-backed rather than a signed JWT
 * so sessions can be revoked (logout, password change) server-side.
 */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => undefined);
  }
  cookieStore.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}

/** Resolves the current session cookie to a User row, or null. */
export async function getSessionUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  // Sliding expiration: extend TTL if more than half has elapsed
  const elapsed = Date.now() - session.createdAt.getTime();
  if (elapsed > SLIDING_REFRESH_THRESHOLD_MS) {
    const newExpiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: newExpiresAt },
    }).catch(() => undefined);
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: newExpiresAt,
    });
  }

  return session.user;
}

/**
 * Deletes all sessions for a user — call this when the user changes
 * their password to invalidate every existing session.
 */
export async function invalidateUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } }).catch(() => undefined);
}
