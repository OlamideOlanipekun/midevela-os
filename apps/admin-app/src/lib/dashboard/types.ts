export interface DashboardSummary {
  health: HealthScore;
  kpis: KPIData;
  revenue: RevenueData[];
  merchantGrowth: MerchantGrowthData[];
  conversations: ConversationTrendData[];
  ai: AIHealthData;
  queues: QueueData[];
  infrastructure: InfrastructureData[];
  activity: ActivityItem[];
  topMerchants: TopMerchant[];
  alerts: AlertItem[];
}

export interface HealthScore {
  score: number;
  label: string;
  components: HealthComponent[];
}

export interface HealthComponent {
  name: string;
  status: "healthy" | "degraded" | "down";
  score: number;
}

export interface KPIData {
  revenueToday: number;
  revenueChange: number;
  activeMerchants: number;
  newMerchantsToday: number;
  liveVisitors: number;
  activeConversations: number;
  aiResponsesToday: number;
  avgResponseTime: number;
  failedRequests: number;
  queueJobs: number;
}

export interface RevenueData {
  date: string;
  revenue: number;
  subscriptions: number;
  upgrades: number;
}

export interface MerchantGrowthData {
  date: string;
  newMerchants: number;
  total: number;
}

export interface ConversationTrendData {
  date: string;
  messages: number;
  conversations: number;
  handovers: number;
  resolved: number;
}

export interface AIHealthData {
  avgConfidence: number;
  hallucinationRate: number;
  responseTime: number;
  fallbackRate: number;
}

export interface QueueData {
  name: string;
  status: "running" | "pending" | "healthy" | "failed";
  count?: number;
}

export interface InfrastructureData {
  name: string;
  status: "up" | "degraded" | "down";
}

export interface ActivityItem {
  id: string;
  time: string;
  title: string;
  type: "onboard" | "payment" | "crawl" | "upgrade" | "knowledge" | "escalation";
}

export interface TopMerchant {
  id: string;
  name: string;
  revenue: number;
  conversations: number;
  conversion: number;
  aiScore: number;
}

export interface AlertItem {
  id: string;
  type: "critical" | "warning" | "success" | "info";
  title: string;
  time: string;
}
