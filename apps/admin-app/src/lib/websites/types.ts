export interface WebsiteListItem {
  id: string;
  domain: string;
  normalizedUrl: string;
  merchantName: string;
  merchantId: string;
  health: number;
  crawlStatus: string;
  products: number;
  pages: number;
  sslStatus: string;
  status: string;
  verified: boolean;
  createdAt: string;
}

export interface WebsiteListResponse {
  items: WebsiteListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface WebsiteDetail {
  id: string;
  domain: string;
  normalizedUrl: string;
  status: string;
  verified: boolean;
  verificationMethod: string | null;
  sslStatus: string;
  robotsStatus: string;
  healthScore: number;
  health: WebsiteHealthScore;
  crawlStatus: string;
  lastCrawledAt: string | null;
  nextCrawlAt: string | null;
  createdAt: string;
  updatedAt: string;
  merchant: { id: string; name: string; slug: string };
  products: number;
  knowledgeEntries: number;
  recentCrawls: CrawlJobItem[];
}

export interface WebsiteHealthScore {
  score: number;
  label: string;
  ssl: number;
  crawler: number;
  knowledge: number;
  products: number;
  availability: number;
}

export interface CrawlJobItem {
  id: string;
  status: string;
  pagesFound: number;
  productsFound: number;
  categoriesFound: number;
  errors: number;
  duration: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface WebsiteHealthData {
  uptime: number;
  ssl: number;
  robots: number;
  responseTime: number;
  pages: number;
  products: number;
  knowledge: number;
  lastChecked: string;
}

export interface WebsiteAnalyticsData {
  productsGrowth: { date: string; count: number }[];
  pagesIndexed: { date: string; count: number }[];
  crawlTimes: { date: string; duration: number }[];
  errors: { date: string; count: number }[];
  knowledgeGrowth: { date: string; count: number }[];
}
