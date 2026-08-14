/**
 * Commerce Adapter Factory (Milestone C2)
 *
 * Instantiates the appropriate CommerceAdapter for an organization.
 */

import prisma from "@/lib/prisma";
import type { CommerceAdapter } from "./types";
import { NativeMidevelaCommerceAdapter } from "./nativeAdapter";
import { ShopifyCommerceAdapter } from "./shopifyAdapter";
import { WooCommerceCommerceAdapter } from "./woocommerceAdapter";
import { CustomRestCommerceAdapter } from "./customRestAdapter";

export async function getCommerceAdapter(orgId: string): Promise<CommerceAdapter> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { settings: true },
  });

  const settings = (org?.settings ?? {}) as Record<string, any>;
  const platform = settings.commercePlatform as string | undefined;

  if (platform === "shopify" && settings.shopify) {
    return new ShopifyCommerceAdapter(orgId, {
      shopDomain: settings.shopify.shopDomain,
      storefrontAccessToken: settings.shopify.storefrontAccessToken,
    });
  }

  if (platform === "woocommerce" && settings.woocommerce) {
    return new WooCommerceCommerceAdapter(orgId, {
      storeUrl: settings.woocommerce.storeUrl,
      consumerKey: settings.woocommerce.consumerKey,
      consumerSecret: settings.woocommerce.consumerSecret,
    });
  }

  if (platform === "custom_rest" && settings.customRest) {
    return new CustomRestCommerceAdapter(orgId, {
      baseUrl: settings.customRest.baseUrl,
      apiKey: settings.customRest.apiKey,
    });
  }

  // Fallback default: Native Midevela Commerce Adapter
  return new NativeMidevelaCommerceAdapter(orgId);
}
