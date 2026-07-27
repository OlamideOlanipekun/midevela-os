export interface ConversationListItem {
  id: string;
  customerName: string | null;
  customerEmail: string | null;
  merchantName: string;
  merchantId: string;
  started: string;
  status: string;
  outcome: string;
  messages: number;
  aiConfidence: number;
  qualityScore: number;
  intent: string;
  tags: string[];
  humanJoined: boolean;
}

export interface ConversationDetail {
  id: string;
  status: string;
  outcome: string;
  intent: string;
  aiConfidence: number;
  qualityScore: number;
  qualityLabel: string;
  tags: string[];
  humanJoined: boolean;
  aiPaused: boolean;
  createdAt: string;
  merchant: { id: string; name: string; slug: string };
  customer: CustomerProfile;
  messages: MessageItem[];
  events: ConversationEventItem[];
}

export interface CustomerProfile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  device: string | null;
  browser: string | null;
  ip: string | null;
  firstSeen: string;
  lastSeen: string;
  totalConversations: number;
  totalOrders: number;
  lifetimeValue: number;
  returning: boolean;
  currentPage: string | null;
  productsViewed: string[];
  sessionDuration: number;
}

export interface MessageItem {
  id: string;
  role: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  confidence: number;
  latency: number;
  promptVersion: string | null;
  modelUsed: string | null;
  knowledgeSources: string[];
  productsUsed: string[];
  createdAt: string;
}

export interface ConversationEventItem {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface AIReasoning {
  intent: string;
  knowledgeSources: { title: string }[];
  productsConsidered: { name: string; price: number }[];
  productsRanked: { name: string; score: number }[];
  recommended: { name: string; reason: string } | null;
  confidence: number;
}

export interface RecommendationData {
  productsConsidered: string[];
  productsRanked: string[];
  productSent: string | null;
  customerClicked: boolean;
  purchased: boolean;
}

export interface ConversationAnalytics {
  liveConversations: number;
  resolved: number;
  escalated: number;
  avgResponseTime: number;
  avgDuration: number;
  aiSuccessRate: number;
  humanTakeovers: number;
  totalToday: number;
  avgQualityScore: number;
}

export interface ReplayEvent {
  type: string;
  role?: string;
  content?: string;
  delay: number;
  createdAt: string;
}
