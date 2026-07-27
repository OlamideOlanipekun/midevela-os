export interface AuditLogItem {
  id: string;
  adminId: string | null;
  adminName: string | null;
  action: string;
  module: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface SecurityEventItem {
  id: string;
  adminId: string | null;
  orgId: string | null;
  type: string;
  severity: string;
  detail: string | null;
  ip: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditDashboard {
  totalEvents: number;
  uniqueAdmins: number;
  topActions: { action: string; count: number }[];
  topModules: { module: string; count: number }[];
  eventsToday: number;
  securityEvents: number;
}

export interface ComplianceExportItem {
  id: string;
  type: string;
  format: string;
  status: string;
  recordCount: number;
  createdAt: string;
}
