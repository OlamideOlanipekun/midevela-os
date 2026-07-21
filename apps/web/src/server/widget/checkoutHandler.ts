import prisma from "@/lib/prisma";
import { formatMoney } from "@/server/catalog/money";

export interface PaymentLinkResult {
  paymentUrl: string;
  isPaystack: boolean;
  productName: string;
  productPrice: string;
  reference?: string;
}

/**
 * Generates a payment link for a product.
 *
 * Two modes:
 *   1. If the merchant has configured Paystack via OrgSettings → creates
 *      a real Paystack payment link for the product price.
 *   2. Otherwise → returns the product's source URL (merchant's own store).
 *
 * The merchant configures their Paystack secret key in the dashboard
 * settings under OrgSettings.paystackSecretKey.
 */
export async function generatePaymentLink(input: {
  productId: string;
  orgId: string;
  customerEmail?: string;
  callbackUrl?: string;
}): Promise<PaymentLinkResult | null> {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, orgId: input.orgId },
    select: {
      id: true,
      name: true,
      price: true,
      currency: true,
      sourceUrl: true,
    },
  });
  if (!product) return null;

  const org = await prisma.organization.findUnique({
    where: { id: input.orgId },
    select: { settings: true, name: true },
  });
  if (!org) return null;

  const settings = (org.settings ?? {}) as Record<string, unknown>;
  const paystackKey = settings.paystackSecretKey as string | undefined;
  const paystackPublicKey = settings.paystackPublicKey as string | undefined;

  const productPrice = formatMoney(product.price, product.currency);

  // Try Paystack if merchant has configured their key
  if (paystackKey) {
    try {
      const amountKobo = Math.round(Number(product.price) * 100);
      const email = input.customerEmail || "customer@example.com";
      const callbackUrl =
        input.callbackUrl ||
        (product.sourceUrl ? product.sourceUrl : "https://midevela.com/checkout/success");

      const res = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amountKobo,
          currency: product.currency || "NGN",
          metadata: {
            orgId: input.orgId,
            productId: input.productId,
            productName: product.name,
          },
          callback_url: callbackUrl,
        }),
      });

      const data = await res.json();
      if (res.ok && data?.status) {
        return {
          paymentUrl: data.data.authorization_url,
          isPaystack: true,
          productName: product.name,
          productPrice,
          reference: data.data.reference,
        };
      }
    } catch {
      // Paystack failed — fall through to URL fallback
    }
  }

  // Fallback: product source URL
  if (product.sourceUrl) {
    return {
      paymentUrl: product.sourceUrl,
      isPaystack: false,
      productName: product.name,
      productPrice,
    };
  }

  return null;
}
