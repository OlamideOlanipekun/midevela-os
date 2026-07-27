export interface AIHealthData {
  overallHealth: number;
  models: ModelStatus[];
  avgConfidence: number;
  latency: number;
  dailyCost: number;
  hallucinationRate: number;
  fallbackRate: number;
  promptVersion: string;
}

export interface ModelStatus {
  name: string;
  status: string;
  healthScore: number;
  latency: number;
  errorRate: number;
  requestsPerMin: number;
}

export interface PromptItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface PromptVersionItem {
  id: string;
  promptId: string;
  version: number;
  content: string;
  model: string;
  temperature: number;
  maxTokens: number;
  notes: string | null;
  authorId: string | null;
  createdAt: string;
}

export interface AIMetrics {
  totalRequests: number;
  successRate: number;
  avgLatency: number;
  avgTokens: number;
  totalTokens: number;
  errors: number;
  fallbacks: number;
}

export interface AICostData {
  daily: CostPoint[];
  perMerchant: CostPoint[];
  perModel: CostPoint[];
  totalToday: number;
  totalMonth: number;
}

export interface CostPoint {
  date: string;
  model?: string;
  orgId?: string;
  cost: number;
  tokens: number;
  requests: number;
}

export interface AIErrorItem {
  id: string;
  orgId: string | null;
  model: string;
  type: string;
  message: string | null;
  statusCode: number | null;
  latency: number | null;
  createdAt: string;
}

export interface ModelRouteItem {
  id: string;
  intent: string;
  model: string;
  fallback: string | null;
  priority: number;
  rules: Record<string, unknown>;
  active: boolean;
}

export interface PromptDetail extends PromptItem {
  versions: PromptVersionItem[];
}
