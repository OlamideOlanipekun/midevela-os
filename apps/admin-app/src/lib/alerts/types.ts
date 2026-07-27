export interface AlertItem {
  id: string;
  ruleId: string | null;
  orgId: string | null;
  type: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  message: string | null;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "ESCALATED";
  metadata: Record<string, unknown>;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface AlertRuleItem {
  id: string;
  name: string;
  type: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  condition: Record<string, unknown>;
  channels: string[];
  cooldown: number;
  active: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AlertDashboard {
  critical: number;
  warning: number;
  info: number;
  open: number;
  acknowledged: number;
  escalated: number;
  totalToday: number;
  byType: { type: string; count: number }[];
}

export interface NotificationPreferenceItem {
  email: boolean;
  slack: boolean;
  webhook: boolean;
  digest: string;
}
