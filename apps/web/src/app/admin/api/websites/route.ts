import { NextRequest, NextResponse } from "next/server";
import { withAdminHandler } from "@/server/http";
import { requireAdmin } from "@/server/admin/auth";
import { requirePermission } from "@/server/admin/rbac";
import {
  listAllWebsites,
  suspendWebsite,
  reactivateWebsite,
  deleteWebsite,
} from "@/server/website/service";

export const GET = withAdminHandler(async (_req: NextRequest, _context) => {
  const admin = await requireAdmin();
  await requirePermission(admin, { module: "merchants", action: "read" });

  const websites = await listAllWebsites();
  return NextResponse.json({ websites });
});

export const PATCH = withAdminHandler(async (req: NextRequest, _context) => {
  const admin = await requireAdmin();
  await requirePermission(admin, { module: "merchants", action: "write" });

  const { websiteId, action } = await req.json();

  if (!websiteId || !action) {
    return NextResponse.json({ error: "websiteId and action are required" }, { status: 400 });
  }

  let website;
  switch (action) {
    case "suspend":
      website = await suspendWebsite(websiteId);
      break;
    case "reactivate":
      website = await reactivateWebsite(websiteId);
      break;
    case "delete":
      website = await deleteWebsite(websiteId);
      break;
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  return NextResponse.json({ website });
});
