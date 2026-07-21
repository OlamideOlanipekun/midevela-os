import type { OrgSettings } from "@/server/tenancy/org";

export interface EscalationResult {
  replyText: string;
  escalated: boolean;
}

/**
 * When confidence is low or the assistant can't handle the request,
 * offer a graceful handoff to the merchant.
 */
export function escalate(
  reason: "low_confidence" | "unhandled_intent" | "repeated_confusion",
  orgSettings: Partial<OrgSettings>,
): EscalationResult {
  const settings = orgSettings as Record<string, unknown>;
  const whatsapp = settings.whatsappNumber as string | undefined;
  const channels = settings.channels as string[] | undefined;
  const orgName = settings.name as string | undefined;

  const contactOptions: string[] = [];
  if (whatsapp) contactOptions.push(`• WhatsApp: **${whatsapp}**`);
  if (channels?.includes("email")) contactOptions.push("• Email");
  if (channels?.includes("phone")) contactOptions.push("• Phone");

  const baseMessage = `I want to make sure you get the best help possible.`;

  switch (reason) {
    case "low_confidence":
      return {
        replyText: [
          baseMessage,
          `I'm not completely sure about this one. Let me connect you with ${orgName || "the team"} who can help further.`,
          ...(contactOptions.length > 0 ? [``, ...contactOptions] : []),
        ].join("\n"),
        escalated: true,
      };

    case "unhandled_intent":
      return {
        replyText: [
          `I can't quite handle this request yet.`,
          `Would you like to reach out to ${orgName || "the team"} directly?`,
          ...(contactOptions.length > 0 ? [``, ...contactOptions] : []),
        ].join("\n"),
        escalated: true,
      };

    case "repeated_confusion":
      return {
        replyText: [
          baseMessage,
          `I've noticed you're asking about something I might not be able to help with fully.`,
          `Let me connect you with a human who can assist:`,
          ...(contactOptions.length > 0 ? [``, ...contactOptions] : []),
        ].join("\n"),
        escalated: true,
      };
  }
}
