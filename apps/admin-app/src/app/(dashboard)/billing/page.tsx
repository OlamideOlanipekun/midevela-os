"use client";

import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api/request";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { BillingDashboard, PlanItem, SubscriptionItem, InvoiceItem, PaymentItem, RefundItem, CouponItem } from "@/lib/billing/types";

export default function BillingPage() {
  const [dash, setDash] = useState<BillingDashboard | null>(null);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [refunds, setRefunds] = useState<RefundItem[]>([]);
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"dashboard" | "plans" | "subscriptions" | "invoices" | "payments" | "refunds">("dashboard");

  useEffect(() => {
    Promise.all([
      apiRequest<BillingDashboard>("/api/admin/billing"),
      apiRequest<PlanItem[]>("/api/admin/plans"),
      apiRequest<SubscriptionItem[]>("/api/admin/subscriptions?limit=10"),
      apiRequest<InvoiceItem[]>("/api/admin/invoices?limit=10"),
      apiRequest<PaymentItem[]>("/api/admin/payments?limit=10"),
      apiRequest<RefundItem[]>("/api/admin/refunds?limit=5"),
      apiRequest<CouponItem[]>("/api/admin/coupons"),
    ]).then(([d, p, s, i, pm, r, c]) => {
      if (d.ok) setDash(d.data);
      if (p.ok) setPlans(Array.isArray(p.data) ? p.data : []);
      if (s.ok) setSubscriptions(Array.isArray(s.data) ? s.data : ((s.data as any)?.items || []));
      if (i.ok) setInvoices(Array.isArray(i.data) ? i.data : ((i.data as any)?.items || []));
      if (pm.ok) setPayments(Array.isArray(pm.data) ? pm.data : ((pm.data as any)?.items || []));
      if (r.ok) setRefunds(Array.isArray(r.data) ? r.data : ((r.data as any)?.items || []));
      if (c.ok) setCoupons(Array.isArray(c.data) ? c.data : []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flx-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="flx-col gap-4">
      <div className="dash-header">
        <div>
          <div className="dash-breadcrumb">Billing</div>
          <h1 className="dash-title">Billing & Subscription Center</h1>
        </div>
      </div>

      <div className="flx-row gap-1 border-b border-border pb-2">
        {(["dashboard", "plans", "subscriptions", "invoices", "payments", "refunds"] as const).map((t) => (
          <button key={t} className={`px-3 py-1.5 text-sm font-medium rounded-t ${tab === t ? "bg-paper-raised border border-border border-b-transparent text-teal-deep" : "text-ink-soft hover:text-ink"}`} onClick={() => setTab(t)}>
            {t === "dashboard" ? "Dashboard" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "dashboard" && dash && (
        <>
          <div className="dash-grid-3col">
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold text-teal">₦{(dash.mrr / 1e6).toFixed(1)}M</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">MRR</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold">₦{(dash.arr / 1e6).toFixed(1)}M</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">ARR</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold">{dash.activePlans}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Active Subscriptions</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold text-gold">{dash.trials}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Trials</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold">{dash.enterprise}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Enterprise</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold text-rust">{dash.failedPayments}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Failed Payments</div>
            </div>
          </div>

          {/* Plans */}
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Plans</div>
            <div className="flx-row gap-3 p-4">
              {plans.map((p) => (
                <div key={p.id} className="flex-1 p-4 rounded-xl border border-border bg-paper">
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="text-2xl font-bold mt-1">₦{p.priceMonthly.toLocaleString()}<span className="text-xs text-ink-soft font-normal">/mo</span></div>
                  <div className="text-xs text-ink-soft mt-2">{p.description}</div>
                  <div className="mt-3 space-y-1">
                    {(p.features as string[]).slice(0, 4).map((f, i) => (
                      <div key={i} className="text-xs text-ink">✓ {f}</div>
                    ))}
                  </div>
                  <Badge variant={p.active ? "teal" : "default"} size="sm" className="mt-2">{p.active ? "Active" : "Inactive"}</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Invoices */}
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Recent Invoices</div>
            <div className="divide-y divide-border">
              {invoices.map((i) => (
                <div key={i.id} className="px-4 py-3 flx-row justify-between items-center">
                  <div>
                    <div className="text-sm font-medium">{i.invoiceNumber}</div>
                    <div className="text-xs text-ink-soft">{i.merchantName || "N/A"} · Due {i.dueDate ? new Date(i.dueDate).toLocaleDateString() : "N/A"}</div>
                  </div>
                  <div className="flx-row gap-2 items-center">
                    <span className="text-sm font-mono">₦{i.total.toLocaleString()}</span>
                    <Badge variant={i.status === "PAID" ? "teal" : i.status === "OVERDUE" ? "rust" : i.status === "PENDING" ? "gold" : "default"} size="sm">{i.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === "plans" && (
        <div className="flx-row gap-3 flex-wrap">
          {plans.map((p) => (
            <div key={p.id} className="flex-1 min-w-[200px] p-4 rounded-xl border border-border bg-paper-raised">
              <div className="text-sm font-semibold">{p.name}</div>
              <div className="text-2xl font-bold mt-1">₦{p.priceMonthly.toLocaleString()}<span className="text-xs text-ink-soft font-normal">/mo</span></div>
              {p.priceYearly && <div className="text-xs text-ink-soft">₦{p.priceYearly.toLocaleString()}/yr</div>}
              <div className="text-xs text-ink-soft mt-2">{p.description}</div>
              <div className="mt-3 space-y-1">
                {(p.features as string[]).map((f, i) => (
                  <div key={i} className="text-xs text-ink">✓ {f}</div>
                ))}
              </div>
              <div className="mt-3 text-xs text-ink-soft">Code: {p.code} · Order: {p.sortOrder}</div>
              <Badge variant={p.active ? "teal" : "default"} size="sm" className="mt-2">{p.active ? "Active" : "Inactive"}</Badge>
            </div>
          ))}
        </div>
      )}

      {tab === "subscriptions" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Subscriptions</div>
          <div className="divide-y divide-border">
            {subscriptions.map((s) => (
              <div key={s.id} className="px-4 py-3 flx-row justify-between items-center">
                <div>
                  <div className="text-sm font-medium">{s.merchantName}</div>
                  <div className="text-xs text-ink-soft">{s.planName} · {s.trialEndsAt ? `Trial ends ${new Date(s.trialEndsAt).toLocaleDateString()}` : ""}</div>
                </div>
                <Badge variant={s.status === "ACTIVE" ? "teal" : s.status === "TRIALING" ? "gold" : s.status === "CANCELLED" ? "rust" : "default"} size="sm">{s.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "invoices" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Invoices</div>
          <div className="divide-y divide-border">
            {invoices.map((i) => (
              <div key={i.id} className="px-4 py-3 flx-row justify-between items-center">
                <div>
                  <div className="text-sm font-medium">{i.invoiceNumber}</div>
                  <div className="text-xs text-ink-soft">{i.merchantName || "N/A"} · {new Date(i.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="flx-row gap-3 items-center">
                  <span className="text-sm font-mono">₦{i.total.toLocaleString()}</span>
                  <Badge variant={i.status === "PAID" ? "teal" : i.status === "OVERDUE" ? "rust" : i.status === "PENDING" ? "gold" : "default"} size="sm">{i.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "payments" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Payments</div>
          <div className="divide-y divide-border">
            {payments.map((p) => (
              <div key={p.id} className="px-4 py-3 flx-row justify-between items-center">
                <div>
                  <div className="text-sm font-medium">{p.merchantName || "N/A"}</div>
                  <div className="text-xs text-ink-soft">{p.reference || "No ref"} · {p.gateway} · {p.method}</div>
                </div>
                <div className="flx-row gap-2 items-center">
                  <span className="text-sm font-mono">₦{p.amount.toLocaleString()}</span>
                  <Badge variant={p.status === "SUCCEEDED" ? "teal" : p.status === "FAILED" ? "rust" : p.status === "REFUNDED" ? "gold" : "default"} size="sm">{p.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "refunds" && (
        <div className="flx-col gap-3">
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Refund Requests</div>
            <div className="divide-y divide-border">
              {refunds.map((r) => (
                <div key={r.id} className="px-4 py-3 flx-row justify-between items-center">
                  <div>
                    <div className="text-sm font-medium">₦{r.amount.toLocaleString()}</div>
                    <div className="text-xs text-ink-soft">{r.reason || "No reason"} · {new Date(r.createdAt).toLocaleDateString()}</div>
                  </div>
                  <Badge variant={r.status === "approved" ? "teal" : r.status === "rejected" ? "rust" : "gold"} size="sm">{r.status}</Badge>
                </div>
              ))}
              {refunds.length === 0 && <div className="px-4 py-6 text-sm text-ink-soft text-center">No refund requests</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
