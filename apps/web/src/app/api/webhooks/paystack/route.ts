import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyWebhookSignature } from "@/server/billing/paystack";
import {
  activateSubscriptionFromPayment,
  extendSubscriptionByCustomer,
  linkSubscriptionCode,
  markPastDueByCustomer,
  cancelByCustomer,
} from "@/server/billing/subscription";
import { alert } from "@/server/observability/notify";
import { publishPaymentSucceeded, publishPaymentFailed, publishPurchaseCompleted } from "@/server/events/instrument";

/**
 * Public endpoint — Paystack calls this directly, there's no logged-in
 * user. The signature check IS the auth boundary here; nothing below it
 * runs without it passing first.
 *
 * Idempotency: Paystack retries deliver the identical body (identical
 * HMAC signature), so we record each processed signature and skip
 * replays. We record AFTER successful processing — a failed event must
 * NOT be marked processed, or the retry that would fix it gets skipped.
 * The state transitions below are all idempotent, so the small window
 * where two identical deliveries process concurrently is harmless.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.error("Paystack webhook: signature verification failed.");
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }
  // Signature is verified above, so it's non-null here.
  const sig = signature as string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Replay? Already fully processed — ack without re-applying.
  const seen = await prisma.webhookEvent.findUnique({ where: { signature: sig } });
  if (seen) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const eventType: string = event?.event ?? "unknown";
  const data = event?.data ?? {};
  const customerCode: string | null = data.customer?.customer_code ?? null;

  try {
    switch (eventType) {
      case "charge.success": {
        const orgId = data.metadata?.orgId;
        const planCode = data.metadata?.planCode;
        const paidAt = data.paid_at ? new Date(data.paid_at) : new Date();

        if (typeof orgId === "string" && typeof planCode === "string") {
          // First payment of a subscription — carries our metadata.
          await activateSubscriptionFromPayment({
            orgId,
            planCode,
            paystackCustomerCode: customerCode,
            paystackSubscriptionCode: data.subscription_code ?? null,
            paidAt,
          });
          publishPaymentSucceeded(orgId, data.amount / 100, "NGN", planCode);
          publishPurchaseCompleted(orgId, data.customer?.email ?? "unknown", data.amount / 100, "NGN", []);
        } else if (customerCode) {
          // Recurring auto-renewal — no metadata, match by customer code.
          const matched = await extendSubscriptionByCustomer(customerCode, paidAt);
          if (!matched) {
            console.error("Paystack webhook: recurring charge for unknown customer.", customerCode, data.reference);
          }
        } else {
          console.error("Paystack webhook: charge.success with no metadata and no customer code.", data.reference);
        }
        break;
      }

      case "subscription.create": {
        const subCode = data.subscription_code;
        if (customerCode && typeof subCode === "string") {
          await linkSubscriptionCode(customerCode, subCode);
        }
        break;
      }

      case "invoice.payment_failed": {
        // A renewal charge failed — enter the dunning (past_due) window.
        if (customerCode) {
          await markPastDueByCustomer(customerCode);
          publishPaymentFailed(customerCode, data.amount / 100, data.failure_reason ?? "Unknown");
        }
        break;
      }

      case "subscription.disable":
      case "subscription.not_renew": {
        if (customerCode) await cancelByCustomer(customerCode);
        break;
      }

      default:
        // Acknowledge anything we don't act on so Paystack doesn't retry it.
        break;
    }
  } catch (err) {
    // Processing failed — do NOT record the signature, so Paystack's retry
    // reprocesses it. Alert on the money-critical activation case.
    await alert("Paystack webhook: processing FAILED", {
      eventType,
      reference: data.reference,
      customerCode,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }

  // Mark processed only after success. Guard the insert against a race
  // where a concurrent duplicate already recorded it.
  try {
    await prisma.webhookEvent.create({
      data: { provider: "paystack", signature: sig, eventType },
    });
  } catch {
    // Unique-violation from a concurrent duplicate — the work is done.
  }

  return NextResponse.json({ received: true });
}
