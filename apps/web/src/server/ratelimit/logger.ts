import prisma from "@/lib/prisma";

export interface RateLimitBlockInfo {
  type: "info" | "warning" | "error";
  ip: string;
  email?: string;
  endpoint: string;
  reason: string;
  attempts?: number;
  userAgent?: string;
}

/**
 * Log a rate-limit block to the system_events table for admin visibility.
 * Non-throwing — failures are silently caught so rate limiting is never
 * compromised by a logging failure.
 */
export async function logRateLimitBlock(info: RateLimitBlockInfo): Promise<void> {
  try {
    await prisma.systemEvent.create({
      data: {
        type: info.type || "warning",
        source: "rate-limit",
        title: `Rate limit hit: ${info.endpoint}`,
        message: info.reason,
        metadata: {
          ip: info.ip,
          email: info.email || null,
          endpoint: info.endpoint,
          reason: info.reason,
          attempts: info.attempts || null,
          userAgent: info.userAgent || null,
        },
      },
    });
  } catch {
    // Logging must never break rate limiting.
  }
}
