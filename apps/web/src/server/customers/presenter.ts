import type { Customer, BuyingStage } from "@prisma/client";

export const STAGE_LABELS: Record<BuyingStage, string> = {
  EXPLORING: "Exploring",
  COMPARING: "Comparing",
  PURCHASE_READY: "Purchase ready",
  PURCHASED: "Purchased",
};

export const STAGE_BADGE_CLASS: Record<BuyingStage, string> = {
  EXPLORING: "badge-blue",
  COMPARING: "badge-gold",
  PURCHASE_READY: "badge-green",
  PURCHASED: "badge-green",
};

/** Real widget-created customers usually have no name/email — the
 *  widget only ever collects a device-generated externalId. */
export function displayName(c: Pick<Customer, "name" | "email" | "externalId" | "id">): string {
  if (c.name?.trim()) return c.name.trim();
  if (c.email?.trim()) return c.email.trim();
  const fallbackId = c.externalId?.trim() || c.id;
  return `Visitor ${fallbackId.slice(-6)}`;
}
