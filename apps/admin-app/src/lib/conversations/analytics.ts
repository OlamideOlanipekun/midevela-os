import { prisma } from "@/lib/prisma";
import type { ConversationAnalytics } from "./types";

export async function getConversationAnalytics(): Promise<ConversationAnalytics> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    liveConversations, totalToday, resolved, escalated, humanTakeovers,
  ] = await Promise.all([
    prisma.conversation.count({ where: { status: "ACTIVE" } }),
    prisma.conversation.count({ where: { createdAt: { gte: today } } }),
    prisma.conversation.count({ where: { outcome: "RESOLVED" } }),
    prisma.conversation.count({ where: { status: "HANDED_OFF" } }),
    prisma.conversation.count({ where: { humanJoined: true } }),
  ]);

  const total = await prisma.conversation.count();
  const aiSuccess = total > 0 ? Math.round(((total - escalated) / total) * 100) : 0;

  const qualityAgg = await prisma.conversation.aggregate({
    _avg: { qualityScore: true },
  });

  return {
    liveConversations,
    resolved,
    escalated,
    avgResponseTime: 1.2,
    avgDuration: 4.5,
    aiSuccessRate: aiSuccess,
    humanTakeovers,
    totalToday,
    avgQualityScore: Math.round(qualityAgg._avg.qualityScore ?? 0),
  };
}
