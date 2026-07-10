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
}

export interface InitializeTransactionResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export async function initializeTransaction(
  input: InitializeTransactionInput
): Promise<InitializeTransactionResult> {
  const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      currency: "NGN",
      metadata: input.metadata,
      callback_url: input.callbackUrl,
    }),
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
