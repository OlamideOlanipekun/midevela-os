import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/server/billing/paystack";
import { activateSubscriptionFromPayment } from "@/server/billing/subscription";
import { alert } from "@/server/observability/notify";

/**
 * Public endpoint — Paystack calls this directly, there's no logged-in
 * user. The signature check IS the auth boundary here; nothing below
 * it should ever run without it passing first.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error("Paystack webhook: signature verification failed.");
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (event?.event !== "charge.success") {
    // Acknowledge anything we don't act on so Paystack doesn't retry it.
    return NextResponse.json({ received: true });
  }

  const data = event.data ?? {};
  const orgId = data.metadata?.orgId;
  const planCode = data.metadata?.planCode;

  if (typeof orgId !== "string" || typeof planCode !== "string") {
    console.error("Paystack webhook: charge.success missing orgId/planCode metadata.", data.reference);
    return NextResponse.json({ received: true });
  }

  try {
    await activateSubscriptionFromPayment({
      orgId,
      planCode,
      paystackCustomerCode: data.customer?.customer_code ?? null,
      paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
    });
  } catch (err) {
    // A customer paid but activation failed — this must page a human, not
    // just log. Paystack will retry on the 500, but if it keeps failing
    // someone needs to reconcile it manually.
    await alert("Paystack webhook: subscription activation FAILED (customer may have paid)", {
      reference: data.reference,
      orgId,
      planCode,
      error: err instanceof Error ? err.message : String(err),
    });
    // 500 so Paystack retries — this one really did fail to apply.
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
