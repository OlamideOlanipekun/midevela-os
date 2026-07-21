import prisma from "@/lib/prisma";
import type { OrgSettings } from "@/server/tenancy/org";

export interface BusinessAnswer {
  replyText: string;
  topic: string;
}

const BUSINESS_TOPICS = [
  { keywords: /\b(?:ship|delivery|shipping|deliver|dispatch|tracking)\b/i, topic: "shipping" },
  { keywords: /\b(?:return|refund|exchange|money.back|guarantee)\b/i, topic: "returns" },
  { keywords: /\b(?:hour|open|close|time|today|tomorrow|now|when\s*(?:are|do|can))\b/i, topic: "hours" },
  { keywords: /\b(?:payment|pay|card|credit|debit|transfer|installment|paga|bank)\b/i, topic: "payment" },
  { keywords: /\b(?:contact|reach|phone|call|email|address|location|where\s*(?:are|is))\b/i, topic: "contact" },
  { keywords: /\b(?:warranty|guarantee|certif|authentic)\b/i, topic: "warranty" },
  { keywords: /\b(?:policy|terms|condition|privacy)\b/i, topic: "policies" },
];

export async function answerBusinessQuestion(
  message: string,
  orgSettings: Partial<OrgSettings>,
  orgId: string,
): Promise<BusinessAnswer | null> {
  const lower = message.toLowerCase().trim();

  // Detect the topic
  let matchedTopic: string | null = null;
  for (const entry of BUSINESS_TOPICS) {
    if (entry.keywords.test(lower)) {
      matchedTopic = entry.topic;
      break;
    }
  }
  if (!matchedTopic) return null;

  // Try KnowledgeEntry first (structured FAQ/POLICY)
  const entries = await prisma.knowledgeEntry.findMany({
    where: {
      orgId,
      type: { in: ["FAQ", "POLICY"] },
    },
    select: { title: true, content: true, type: true },
  });

  const relevant = entries.filter(
    (e) =>
      e.title.toLowerCase().includes(matchedTopic!) ||
      e.content.toLowerCase().includes(matchedTopic!) ||
      matchedTopicKeywords(matchedTopic!).some((kw) =>
        e.title.toLowerCase().includes(kw) || e.content.toLowerCase().includes(kw),
      ),
  );

  if (relevant.length > 0) {
    // Use the most relevant entry
    const best = relevant[0];
    return {
      replyText: best.content,
      topic: matchedTopic,
    };
  }

  // Fall back to OrgSettings for known topics
  const settings = orgSettings as Record<string, unknown>;
  switch (matchedTopic) {
    case "hours": {
      const bh = settings.businessHours as { open?: string; close?: string } | undefined;
      if (bh?.open && bh?.close) {
        return {
          replyText: `We're open from **${bh.open}** to **${bh.close}**, Monday through Friday.`,
          topic: "hours",
        };
      }
      break;
    }
    case "contact": {
      const whatsapp = settings.whatsappNumber as string | undefined;
      if (whatsapp) {
        return {
          replyText: `You can reach us on WhatsApp at **${whatsapp}**. We're happy to help!`,
          topic: "contact",
        };
      }
      break;
    }
    case "shipping": {
      for (const entry of entries) {
        if (entry.type === "POLICY" && (entry.title.toLowerCase().includes("shipping") || entry.content.toLowerCase().includes("shipping"))) {
          return { replyText: entry.content, topic: "shipping" };
        }
      }
      break;
    }
  }

  return null;
}

function matchedTopicKeywords(topic: string): string[] {
  const map: Record<string, string[]> = {
    shipping: ["shipping", "delivery", "dispatch", "courier"],
    returns: ["return", "refund", "exchange", "money back"],
    hours: ["hour", "open", "close", "business hour"],
    payment: ["payment", "pay", "card", "bank"],
    contact: ["contact", "phone", "email", "address", "whatsapp"],
    warranty: ["warranty", "guarantee"],
    policies: ["policy", "terms", "conditions"],
  };
  return map[topic] ?? [];
}
