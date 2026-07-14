import { randomBytes } from "crypto";
import type { Organization } from "@prisma/client";
import prisma from "@/lib/prisma";
import { createTrialSubscription } from "@/server/billing/subscription";

/**
 * Widget/behavior settings stored in Organization.settings (JSON).
 * Org identity fields (name, website, country, currency) live in columns.
 */
export interface OrgSettings {
  accentColor: string;
  engagementDelay: number;
  features: {
    exitIntent: boolean;
    showProductImages: boolean;
    playSounds: boolean;
  };
  tone: string;
  greeting: string;
  aiName: string;
  neverSay: string;
  channels: string[];
  whatsappNumber: string;
  sellsDescription: string;
  businessHours: { open: string; close: string };
}

export const defaultOrgSettings: OrgSettings = {
  accentColor: "#1EE67A",
  // Widget v1.0 spec: the assistant proactively opens 3-5s after page
  // load, not 15s - fast enough to feel like a salesperson greeting a
  // visitor, not so fast it interrupts them mid-scroll.
  engagementDelay: 5,
  features: {
    exitIntent: true,
    showProductImages: true,
    playSounds: true,
  },
  tone: "friendly",
  greeting: "Good day! Welcome. How can I help you today?",
  aiName: "Lumi",
  neverSay: "",
  channels: ["website"],
  whatsappNumber: "",
  sellsDescription: "",
  businessHours: { open: "9:00 AM", close: "6:00 PM" },
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function generateWidgetPublicKey(): string {
  return `mdv_pk_${randomBytes(18).toString("base64url")}`;
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "store";
  let candidate = base;
  for (let i = 0; ; i++) {
    const taken = await prisma.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
    candidate = `${base}-${randomBytes(2).toString("hex")}`;
    if (i > 5) return `${base}-${randomBytes(4).toString("hex")}`;
  }
}

export interface CreateOrgInput {
  name: string;
  websiteUrl?: string;
  industry?: string;
  country?: string;
  currency?: string;
  settings?: Partial<OrgSettings>;
}

/**
 * Creates the organization for a freshly onboarded user, links them as
 * OWNER, and issues the default widget key — one transaction-ish unit.
 */
export async function createOrganizationForUser(
  userId: string,
  input: CreateOrgInput
): Promise<{ org: Organization; widgetPublicKey: string }> {
  const slug = await uniqueSlug(input.name);
  const publicKey = generateWidgetPublicKey();

  // New widget keys start with an EMPTY allowlist = permissive (isOriginAllowed
  // treats [] as "allow all"). Deriving it from the onboarding website field
  // was a silent footgun: if the merchant's real store domain differed from
  // what they typed, the widget would 403 and render nothing. Merchants lock
  // this down later in Settings → Widget once they know their real domain.
  const allowedDomains: string[] = [];

  const [org] = await prisma.$transaction([
    prisma.organization.create({
      data: {
        name: input.name,
        slug,
        websiteUrl: input.websiteUrl ?? null,
        industry: input.industry ?? null,
        country: input.country ?? "Nigeria",
        currency: input.currency ?? "NGN",
        settings: { ...defaultOrgSettings, ...(input.settings ?? {}) },
      },
    }),
  ]);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { orgId: org.id, role: "OWNER" },
    }),
    prisma.widgetKey.create({
      data: { orgId: org.id, publicKey, allowedDomains },
    }),
  ]);

  // Best-effort: an org without a trial subscription just reads as
  // "expired" (see subscription.ts) rather than crashing onboarding
  // over it — the merchant can still be walked through picking a plan.
  try {
    await createTrialSubscription(org.id);
  } catch (err) {
    console.error("Failed to create trial subscription:", err);
  }

  return { org, widgetPublicKey: publicKey };
}

/**
 * Settings API contract (matches the frontend's existing shape):
 * org columns merged with the settings JSON.
 */
export function toSettingsResponse(org: Organization) {
  const stored = (org.settings ?? {}) as Partial<OrgSettings>;
  const merged: OrgSettings = {
    ...defaultOrgSettings,
    ...stored,
    features: { ...defaultOrgSettings.features, ...(stored.features ?? {}) },
  };
  return {
    orgName: org.name,
    website: org.websiteUrl ?? "",
    country: org.country,
    currency: org.currency,
    ...merged,
  };
}

export interface UpdateSettingsInput {
  orgName?: string;
  website?: string;
  country?: string;
  currency?: string;
  [key: string]: unknown;
}

export async function updateOrgSettings(
  orgId: string,
  body: UpdateSettingsInput
): Promise<Organization> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
  });
  const stored = (org.settings ?? {}) as Partial<OrgSettings>;

  const { orgName, website, country, currency, features, ...rest } = body as {
    features?: Partial<OrgSettings["features"]>;
  } & UpdateSettingsInput;

  // Only accept known settings keys; drop unknown ones instead of
  // silently persisting dead data (the old prototype bug).
  const settingsKeys = Object.keys(defaultOrgSettings) as (keyof OrgSettings)[];
  const settingsPatch: Record<string, unknown> = {};
  for (const key of settingsKeys) {
    if (key in rest && rest[key] !== undefined) settingsPatch[key] = rest[key];
  }

  return prisma.organization.update({
    where: { id: orgId },
    data: {
      ...(orgName !== undefined ? { name: orgName } : {}),
      ...(website !== undefined ? { websiteUrl: website } : {}),
      ...(country !== undefined ? { country } : {}),
      ...(currency !== undefined ? { currency } : {}),
      settings: {
        ...defaultOrgSettings,
        ...stored,
        ...settingsPatch,
        features: {
          ...defaultOrgSettings.features,
          ...(stored.features ?? {}),
          ...(features ?? {}),
        },
      },
    },
  });
}
