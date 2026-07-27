import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensurePlansSeeded } from "@/server/billing/subscription";

export async function GET() {
  const diagnostics: Record<string, unknown> = {
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    timestamp: new Date().toISOString(),
  };

  try {
    // 1. Test basic connection
    await prisma.$queryRaw`SELECT 1`;
    diagnostics.dbConnected = true;
  } catch (err) {
    diagnostics.dbConnected = false;
    diagnostics.dbError = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, diagnostics }, { status: 500 });
  }

  try {
    // 2. Check if users table exists
    const userCount = await prisma.user.count();
    diagnostics.usersTableExists = true;
    diagnostics.userCount = userCount;
  } catch (err) {
    diagnostics.usersTableExists = false;
    diagnostics.tableError = err instanceof Error ? err.message : String(err);
  }

  try {
    // 3. Ensure default plans exist
    await ensurePlansSeeded();
    diagnostics.plansSeeded = true;
  } catch (err) {
    diagnostics.plansSeeded = false;
    diagnostics.planError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    success: diagnostics.dbConnected && diagnostics.usersTableExists,
    diagnostics,
  });
}
