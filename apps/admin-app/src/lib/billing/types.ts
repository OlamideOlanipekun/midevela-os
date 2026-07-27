export interface BillingDashboard {
  mrr: number;
  arr: number;
  activePlans: number;
  trials: number;
  enterprise: number;
  failedPayments: number;
  outstandingInvoices: number;
}

export interface PlanItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number | null;
  currency: string;
  active: boolean;
  sortOrder: number;
  features: string[];
  limits: Record<string, unknown>;
}

export interface SubscriptionItem {
  id: string;
  orgId: string;
  merchantName: string;
  planId: string;
  planName: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  orgId: string;
  subscriptionId: string | null;
  invoiceNumber: string;
  amount: number;
  tax: number;
  total: number;
  currency: string;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  dueDate: string | null;
  paidAt: string | null;
  pdfUrl: string | null;
  createdAt: string;
  merchantName?: string;
}

export interface PaymentItem {
  id: string;
  orgId: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  reference: string | null;
  gateway: string | null;
  paidAt: string | null;
  createdAt: string;
  merchantName?: string;
}

export interface RefundItem {
  id: string;
  orgId: string;
  paymentId: string;
  amount: number;
  reason: string | null;
  status: string;
  approvedAt: string | null;
  createdAt: string;
}

export interface CouponItem {
  id: string;
  code: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  active: boolean;
  expiresAt: string | null;
}

export interface UsageRecordItem {
  id: string;
  orgId: string;
  metric: string;
  value: number;
  recordedAt: string;
}

export interface EnterpriseAccountItem {
  id: string;
  orgId: string;
  planId: string;
  customPricing: boolean;
  customPrice: number | null;
  prioritySupport: boolean;
  customSla: string | null;
  privateAiModel: boolean;
  accountManager: string | null;
}
