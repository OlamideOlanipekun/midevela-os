import { NextRequest, NextResponse } from "next/server";
import { withAdminHandler } from "@/server/http";
import { requireAdmin } from "@/server/admin/auth";
import { requirePermission } from "@/server/admin/rbac";
import { rateLimit } from "@/server/ratelimit/limiter";
import {
  getMerchant,
  suspendMerchant,
  unsuspendMerchant,
  deleteMerchant,
  updateMerchantPlan,
  getMerchantActivity,
} from "@/server/admin/merchants";

async function getId(context: { params: Promise<Record<string, string>> }) {
  const p = await context.params;
  return p.id;
}

export const GET = withAdminHandler(async (_req, context) => {
  const id = await getId(context);
  const admin = await requireAdmin();
  await requirePermission(admin, { module: "merchants", action: "read" });

  const merchant = await getMerchant(id);
  return NextResponse.json(merchant);
});

export const PATCH = withAdminHandler(async (req, context) => {
  const id = await getId(context);
  const admin = await requireAdmin();
  const rl = await rateLimit(`admin:merchant:write:${admin.id}`, 30, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rl.resetSec) } }
    );
  }
  const body = await req.json();

  if (body.action === "suspend") {
    await requirePermission(admin, { module: "merchants", action: "suspend" });
    const result = await suspendMerchant(admin.id, id, body.reason);
    return NextResponse.json(result);
  }

  if (body.action === "unsuspend") {
    await requirePermission(admin, { module: "merchants", action: "suspend" });
    const result = await unsuspendMerchant(admin.id, id);
    return NextResponse.json(result);
  }

  if (body.action === "update_plan") {
    await requirePermission(admin, { module: "merchants", action: "write" });
    const result = await updateMerchantPlan(admin.id, id, body.planCode);
    return NextResponse.json(result);
  }

  if (body.action === "activity") {
    const result = await getMerchantActivity(id, body.limit || 20);
    return NextResponse.json({ items: result });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
});

export const DELETE = withAdminHandler(async (_req, context) => {
  const id = await getId(context);
  const admin = await requireAdmin();
  const rl = await rateLimit(`admin:merchant:delete:${admin.id}`, 10, 300);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rl.resetSec) } }
    );
  }
  await requirePermission(admin, { module: "merchants", action: "delete" });

  const result = await deleteMerchant(admin.id, id);
  return NextResponse.json(result);
});
