import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import prisma from "@/lib/prisma";

interface ClerkEmail {
  id: string;
  email_address: string;
}

interface ClerkUserPayload {
  id: string;
  email_addresses?: ClerkEmail[];
  primary_email_address_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
}

interface ClerkWebhookEvent {
  type: string;
  data: ClerkUserPayload;
}

/**
 * Clerk → local user sync. Primary path for keeping the `users` table
 * current; `requireUser()` upserts as a fallback for missed deliveries.
 * Configure the endpoint in Clerk Dashboard → Webhooks and set
 * CLERK_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error("CLERK_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let event: ClerkWebhookEvent;
  try {
    event = new Webhook(secret).verify(payload, headers) as ClerkWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const user = event.data;
  const primaryEmail =
    user.email_addresses?.find((e) => e.id === user.primary_email_address_id)
      ?.email_address ?? user.email_addresses?.[0]?.email_address;

  switch (event.type) {
    case "user.created":
    case "user.updated": {
      if (!primaryEmail) break;
      const name =
        [user.first_name, user.last_name].filter(Boolean).join(" ") ||
        primaryEmail.split("@")[0];
      await prisma.user.upsert({
        where: { clerkUserId: user.id },
        update: { email: primaryEmail, name, avatarUrl: user.image_url ?? null },
        create: {
          clerkUserId: user.id,
          email: primaryEmail,
          name,
          avatarUrl: user.image_url ?? null,
          role: "OWNER",
        },
      });
      break;
    }
    case "user.deleted": {
      await prisma.user
        .delete({ where: { clerkUserId: user.id } })
        .catch(() => undefined); // already gone — fine
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
