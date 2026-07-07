import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/db";
import { cookies } from "next/headers";

async function checkAuth() {
  const cookieStore = await cookies();
  return cookieStore.get("midevela_mock_auth")?.value === "true";
}

export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = readDb();
  return NextResponse.json({ settings: db.settings });
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const db = readDb();

    // Deep merge / update settings parameters
    db.settings = {
      ...db.settings,
      ...body,
      features: {
        ...db.settings.features,
        ...(body.features || {}),
      },
    };

    writeDb(db);
    return NextResponse.json({ success: true, settings: db.settings });
  } catch (err: any) {
    console.error("Workspace Settings API Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
