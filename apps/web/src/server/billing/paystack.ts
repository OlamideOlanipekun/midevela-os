import { createHmac, timingSafeEqual } from "crypto";

/**
 * Raw fetch against Paystack's REST API — no SDK, matching the pattern
 * already used for Groq/Voyage. Two calls only: initialize a checkout
 * transaction, and verify the webhook signature that confirms payment.
 */

const PAYSTACK_API = "https://api.paystack.co";

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set.");
  return key;
}

export interface InitializeTransactionInput {
  email: string;
  amountKobo: number;
  metadata: Record<string, unknown>;
  callbackUrl: string;
  /**
   * Paystack plan code (PLN_...). When set, this checkout creates a
   * recurring subscription that Paystack auto-charges each interval —
   * the amount is taken from the plan. Omit for a one-time charge.
   */
  planCode?: string;
}

export interface InitializeTransactionResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export async function initializeTransaction(
  input: InitializeTransactionInput
): Promise<InitializeTransactionResult> {
  const body: Record<string, unknown> = {
    email: input.email,
    amount: input.amountKobo,
    currency: "NGN",
    metadata: input.metadata,
    callback_url: input.callbackUrl,
  };
  // Passing `plan` turns this into a subscription sign-up; Paystack then
  // charges the plan amount on its interval automatically.
  if (input.planCode) body.plan = input.planCode;

  const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok || !data?.status) {
    throw new Error(`Paystack initialize failed: ${data?.message ?? res.status}`);
  }

  return {
    authorizationUrl: data.data.authorization_url,
    accessCode: data.data.access_code,
    reference: data.data.reference,
  };
}

export interface CreatePlanInput {
  name: string;
  amountKobo: number;
  /** Paystack billing interval, e.g. "monthly". */
  interval: string;
}

/**
 * Creates a Paystack Plan and returns its plan_code (PLN_...). Used once
 * per pricing tier to back recurring subscriptions. Idempotency is the
 * caller's job — Paystack will happily create duplicate plans with the
 * same name.
 */
export async function createPlan(input: CreatePlanInput): Promise<{ planCode: string }> {
  const res = await fetch(`${PAYSTACK_API}/plan`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.name,
      amount: input.amountKobo,
      interval: input.interval,
      currency: "NGN",
    }),
  });

  const data = await res.json();
  if (!res.ok || !data?.status) {
    throw new Error(`Paystack createPlan failed: ${data?.message ?? res.status}`);
  }
  return { planCode: data.data.plan_code };
}

/**
 * Disables a Paystack subscription so it stops auto-renewing. Paystack's
 * disable endpoint requires both the subscription code and its current
 * email token. Best-effort: used when a customer cancels from our side.
 */
export async function disableSubscription(subscriptionCode: string, emailToken: string): Promise<void> {
  const res = await fetch(`${PAYSTACK_API}/subscription/disable`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code: subscriptionCode, token: emailToken }),
  });
  const data = await res.json();
  if (!res.ok || !data?.status) {
    throw new Error(`Paystack disableSubscription failed: ${data?.message ?? res.status}`);
  }
}

/**
 * Paystack signs webhook bodies with HMAC-SHA512 using the secret key.
 * Must run against the *raw* request body — parsing to JSON and
 * re-stringifying can change byte-for-byte formatting and silently
 * break verification. Timing-safe comparison to avoid leaking the
 * expected signature through response-time differences.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha512", secretKey()).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signatureHeader, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
