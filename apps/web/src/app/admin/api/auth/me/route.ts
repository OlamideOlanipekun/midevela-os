import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/server/http";
import { getAdminSessionUser } from "@/server/admin/auth";
import prisma from "@/lib/prisma";

export const GET = withErrorHandling(async (_req: NextRequest, _context) => {
  const user = await getAdminSessionUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const role = user.roleId
    ? await prisma.adminRole.findUnique({ where: { id: user.roleId } })
    : null;

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      roleName: role?.name ?? null,
      avatarUrl: user.avatarUrl,
    },
  });
});
