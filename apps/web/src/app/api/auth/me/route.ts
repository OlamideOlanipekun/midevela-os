import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";

// Used by the client AuthProvider to bootstrap/refresh the current
// user. Deliberately never throws on "no session" — returns null.
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      orgId: user.orgId,
      avatarUrl: user.avatarUrl,
    },
  });
}
