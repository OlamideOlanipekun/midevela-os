export interface AnalyticsDashboard {
  revenue: number;
  conversations: number;
  recommendations: number;
  conversionRate: number;
  aiAccuracy: number;
  customerSatisfaction: number;
  revenueTrend: { date: string; value: number }[];
  conversationGrowth: { date: string; value: number }[];
  merchantGrowth: { date: string; value: number }[];
  conversionFunnel: { stage: string; users: number; dropoff: number; conversion: number }[];
  topProducts: { name: string; sales: number }[];
  topCategories: { name: string; sales: number }[];
}

export interface RevenueAnalytics {
  mrr: number;
  arr: number;
  revenue: number;
  refunds: number;
  growth: number;
  expansionRevenue: number;
  churnRevenue: number;
  trend: { date: string; revenue: number; mrr: number }[];
}

export interface MerchantAnalytics {
  active: number;
  inactive: number;
  growth: number;
  churn: number;
  averageRevenue: number;
  averageAiScore: number;
}

export interface ConversationAnalyticsData {
  started: number;
  resolved: number;
  escalated: number;
  avgDuration: number;
  avgMessages: number;
  avgResponseTime: number;
}

export interface CustomerAnalytics {
  newCustomers: number;
  returning: number;
  conversionRate: number;
  abandonment: number;
  repeatBuyers: number;
}

export interface FunnelStage {
  stage: string;
  users: number;
  dropoff: number;
  conversion: number;
}

export interface FunnelAnalytics {
  visitor: number;
  conversation: number;
  recommendation: number;
  click: number;
  checkout: number;
  purchase: number;
  stages: FunnelStage[];
}

export interface ForecastPoint {
  date: string;
  value: number;
  lower?: number;
  upper?: number;
}

export interface ForecastData {
  metric: string;
  period: string;
  values: ForecastPoint[];
  confidence: number;
}

export interface ReportItem {
  id: string;
  name: string;
  slug: string;
  metrics: string[];
  schedule: string;
  lastRunAt: string | null;
  createdAt: string;
}
