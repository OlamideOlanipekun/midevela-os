export type ApiKeyItem = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  active: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
};

export type IpRuleItem = {
  id: string;
  cidr: string;
  action: string;
  reason: string | null;
  expiresAt: string | null;
};

export type RateLimitItem = {
  id: string;
  route: string;
  requests: number;
  windowSecs: number;
  description: string | null;
};

export type HardeningDashboard = {
  totalApiKeys: number;
  activeApiKeys: number;
  blockedIps: number;
  rateLimitOverrides: number;
  recentApiKeys: ApiKeyItem[];
  ipRules: IpRuleItem[];
};
