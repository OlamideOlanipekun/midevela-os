export type AIFeedbackItem = {
  id: string;
  conversationId: string | null;
  rating: number;
  category: string;
  comment: string | null;
  createdAt: string;
};

export type AIExperimentItem = {
  id: string;
  name: string;
  modelA: string;
  modelB: string;
  promptKey: string | null;
  trafficPercent: number;
  active: boolean;
  metric: string;
  winner: string | null;
  totalSamples: number;
};

export type AIMonitorItem = {
  id: string;
  model: string;
  totalRequests: number;
  avgLatency: number;
  p95Latency: number;
  errorRate: number;
  tokenCount: number;
  cost: number;
  snapshotAt: string;
};

export type ObservabilityDashboard = {
  totalFeedback: number;
  avgRating: number;
  activeExperiments: number;
  recentSnapshots: AIMonitorItem[];
  recentFeedback: AIFeedbackItem[];
};
