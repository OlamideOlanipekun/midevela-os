import prisma from "@/lib/prisma";

export interface DashboardMetrics {
  activeMerchants: number;
  onlineAgents: number;
  liveConversations: number;
  messagesToday: number;
  recommendations: number;
  handovers: number;
  revenue: number;
  errors: number;
  issues: Array<{ title: string; detail: string; meta: string }>;
  systemStatus: Array<{ name: string; status: "up" | "down" | "degraded" }>;
  recentActivity: Array<{ icon: string; text: string; time: string }>;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    activeMerchants,
    onlineAgents,
    liveConversations,
    messagesToday,
    handovers,
    subscriptions,
    recentIssues,
    activityLogs,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { conversations: { some: { status: "ACTIVE" } } } }),
    prisma.conversation.count({ where: { status: "ACTIVE" } }),
    prisma.message.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.conversation.count({ where: { status: "HANDED_OFF" } }),
    prisma.subscription.findMany({
      where: { status: "ACTIVE" },
      include: { plan: { select: { priceMonthly: true } } },
    }),
    prisma.systemEvent.findMany({
      where: { acknowledged: false },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.auditLog.findMany({
      include: { admin: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const recommendations = await prisma.message.count({
    where: {
      createdAt: { gte: todayStart },
      recommendations: { not: "[]" },
    },
  });

  const revenue = subscriptions.reduce(
    (sum, s) => sum + Number(s.plan.priceMonthly),
    0
  );

  const errors = recentIssues.length;

  const issues = recentIssues.map((e) => ({
    title: e.title,
    detail: e.message ?? "",
    meta: timeAgo(e.createdAt),
  }));

  const systemStatus: Array<{ name: string; status: "up" | "down" | "degraded" }> = [
    { name: "OpenAI", status: "up" },
    { name: "Groq", status: "up" },
    { name: "Redis", status: "up" },
    { name: "Database", status: "up" },
    { name: "Email", status: errors > 0 ? "degraded" : "up" },
    { name: "Payments", status: "up" },
  ];

  const recentActivity = activityLogs.map((a) => {
    const name = a.admin?.name ?? null;
    return {
      icon: activityIcon(a.resource),
      text: name
        ? `<strong>${name}</strong> ${a.action} ${a.resource}`
        : `${a.action} on ${a.resource}`,
      time: timeAgo(a.createdAt),
    };
  });

  return {
    activeMerchants,
    onlineAgents,
    liveConversations,
    messagesToday,
    recommendations,
    handovers,
    revenue,
    errors,
    issues,
    systemStatus,
    recentActivity,
  };
}

function activityIcon(resource: string): string {
  if (resource === "organization") return "org";
  if (resource.startsWith("knowledge")) return "knowledge";
  if (resource === "payment" || resource === "subscription") return "payment";
  if (resource === "conversation") return "handoff";
  return "widget";
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
