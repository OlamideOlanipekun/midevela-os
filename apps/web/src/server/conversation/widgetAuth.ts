import prisma from "@/lib/prisma";

export async function resolveWidgetKey(publicKey: string) {
  const key = await prisma.widgetKey.findUnique({
    where: { publicKey },
    include: { org: true },
  });
  if (!key || !key.active) return null;
  return key;
}

/** Empty allowlist means the key was created without a known website
 *  (dev/testing) — stay permissive rather than lock the merchant out. */
export function isOriginAllowed(allowedDomains: string[], origin: string | null): boolean {
  if (allowedDomains.length === 0) return true;
  if (!origin) return false;
  try {
    const hostname = new URL(origin).hostname;
    return allowedDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}
