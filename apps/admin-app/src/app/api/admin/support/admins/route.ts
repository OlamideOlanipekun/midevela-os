import { NextResponse } from "next/server";
import { listAdmins } from "@/lib/support/service";

export async function GET() {
  const admins = await listAdmins();
  return NextResponse.json(admins);
}
