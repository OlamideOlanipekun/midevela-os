import { NextResponse } from "next/server";
import { withAdminGuard, type AdminRequest } from "@/lib/middleware/admin-guard";
import { prisma } from "@/lib/prisma";

export const GET = withAdminGuard(async (req: AdminRequest) => {
  const admin = await prisma.admin.findUnique({
    where: { id: req.admin.sub },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatar: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  if (!admin) {
    return NextResponse.json({ error: "Admin not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: admin.id,
    name: admin.lastName ? `${admin.firstName} ${admin.lastName}` : admin.firstName,
    firstName: admin.firstName,
    lastName: admin.lastName,
    email: admin.email,
    avatar: admin.avatar,
    isActive: admin.isActive,
    lastLoginAt: admin.lastLoginAt,
    createdAt: admin.createdAt,
    roles: req.admin.roles,
    permissions: req.admin.permissions,
  });
});
