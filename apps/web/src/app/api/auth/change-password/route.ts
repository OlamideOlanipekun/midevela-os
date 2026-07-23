import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withErrorHandling, jsonError } from "@/server/http";
import { requireUser } from "@/server/auth/context";
import { hashPassword, verifyPassword, validatePasswordStrength } from "@/server/auth/password";
import { invalidateUserSessions, createSession } from "@/server/auth/session";

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const user = await requireUser();
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return jsonError(400, "Current password and new password are required.");
    }

    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) return jsonError(400, strengthError);

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return jsonError(401, "Current password is incorrect.");
    }

    const newHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    // Invalidate all existing sessions so the old password no longer works
    // on any device, then issue a fresh session for this request.
    await invalidateUserSessions(user.id);
    await createSession(user.id);

    return NextResponse.json({ success: true });
  });
}
