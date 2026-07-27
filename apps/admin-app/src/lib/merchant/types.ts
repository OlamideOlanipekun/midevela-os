export interface MerchantListItem {
  id: string;
  name: string;
  slug: string;
  websiteUrl: string | null;
  logoUrl: string | null;
  country: string;
  plan: string | null;
  planCode: string | null;
  status: "trialing" | "active" | "past_due" | "cancelled" | "expired";
  health: number;
  conversations: number;
  revenue: number;
  createdAt: string;
  ownerEmail: string | null;
  ownerName: string | null;
}

export interface MerchantListResponse {
  items: MerchantListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MerchantFilters {
  search?: string;
  status?: string;
  plan?: string;
  health?: string;
  country?: string;
  createdFrom?: string;
  createdTo?: string;
  sort?: string;
  order?: "asc" | "desc";
}

export interface MerchantDetail {
  id: string;
  name: string;
  slug: string;
  websiteUrl: string | null;
  logoUrl: string | null;
  industry: string | null;
  country: string;
  currency: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; email: string; name: string | null; lastLoginAt: string | null } | null;
  subscription: {
    id: string;
    status: string;
    planName: string;
    planCode: string;
    priceMonthly: number;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
    createdAt: string;
  } | null;
  websites: {
    id: string;
    normalizedUrl: string;
    status: string;
    crawlStatus: string;
    lastCrawledAt: string | null;
    createdAt: string;
  }[];
  products: number;
  knowledgeEntries: number;
  conversations: number;
  customers: number;
  messages: number;
  health: MerchantHealth;
}

export interface MerchantHealth {
  score: number;
  label: string;
  website: number;
  ai: number;
  knowledge: number;
  billing: number;
  conversations: number;
  crawler: number;
  usage: number;
}

export interface MerchantAnalytics {
  revenue: { total: number; thisMonth: number; lastMonth: number; change: number };
  visitors: { total: number; thisMonth: number; trend: number[] };
  products: { total: number; thisMonth: number };
  messages: { total: number; thisMonth: number; trend: number[] };
  knowledge: { files: number; embeddings: number };
  storage: { bytes: number; formatted: string };
  ai: { avgConfidence: number; hallucinationRate: number; responseTime: number; fallbackRate: number };
  crawler: { pagesCrawled: number; lastCrawl: string | null; status: string };
  conversions: { rate: number; total: number; completed: number };
  recommendations: { total: number; accepted: number; rate: number };
}

export interface MerchantUsage {
  messages: { used: number; limit: number };
  products: { used: number; limit: number };
  knowledgeFiles: { used: number; limit: number };
  storage: { bytes: number; formatted: string; limitBytes: number; limitFormatted: string };
  apiCalls: { total: number; thisMonth: number; limit: number };
  embeddings: { total: number; limit: number };
  crawlerMinutes: { used: number; limit: number };
}

export interface MerchantAIData {
  avgConfidence: number;
  hallucinationRate: number;
  responseTime: number;
  knowledgeCoverage: number;
  escalations: number;
  fallbackRate: number;
  failures: { id: string; query: string; reason: string; date: string }[];
}

export interface MerchantConversationData {
  total: number;
  resolved: number;
  escalated: number;
  avgLength: number;
  avgResponseTime: number;
  conversionRate: number;
  recent: {
    id: string;
    customerName: string | null;
    customerEmail: string | null;
    started: string;
    ended: string | null;
    intent: string;
    status: string;
    outcome: string;
  }[];
}

export interface MerchantBilling {
  plan: { name: string; code: string; priceMonthly: number; currency: string };
  status: string;
  renewal: string | null;
  trialEndsAt: string | null;
  invoices: { id: string; amount: number; status: string; date: string; url: string | null }[];
  paymentMethod: { type: string | null; last4: string | null; expDate: string | null } | null;
  subscriptionId: string;
}

export interface MerchantNoteItem {
  id: string;
  content: string;
  pinned: boolean;
  adminName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantActivityItem {
  id: string;
  time: string;
  action: string;
  adminName: string | null;
  metadata: Record<string, unknown>;
}
