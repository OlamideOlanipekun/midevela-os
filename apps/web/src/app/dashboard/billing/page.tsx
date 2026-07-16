"use client";

import React, { useEffect, useState } from "react";
import { useSubscription } from "@/components/providers/SubscriptionProvider";
import "./billing.css";

interface Plan {
  code: string;
  name: string;
  price: string;
}

interface UsageStatus {
  planCode: string;
  used: number;
  cap: number;
  unlimited: boolean;
  pct: number;
  level: "ok" | "warning" | "critical" | "exceeded";
  periodLabel: string;
}

const STATUS_LABELS: Record<string, string> = {
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  cancelled: "Cancelled",
  expired: "Expired",
};

const USAGE_LEVEL_COLOR: Record<UsageStatus["level"], string> = {
  ok: "var(--teal)",
  warning: "#c8860d",
  critical: "var(--rust)",
  exceeded: "var(--rust)",
};

const USAGE_LEVEL_MESSAGE: Record<UsageStatus["level"], string | null> = {
  ok: null,
  warning: "You're approaching your monthly AI conversation limit.",
  critical: "You're close to your monthly AI limit — upgrade to avoid interruptions.",
  exceeded: "You've reached your monthly AI limit. New widget conversations are paused until next month or you upgrade.",
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

export default function BillingPage() {
  const { subscription, refresh } = useSubscription();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageStatus | null>(null);

  useEffect(() => {
    fetch("/api/billing/plans")
      .then((res) => res.json())
      .then((data) => setPlans(Array.isArray(data.plans) ? data.plans : []))
      .catch(() => setPlans([]));

    fetch("/api/billing/usage")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUsage(data))
      .catch(() => setUsage(null));
  }, []);

  // After returning from Paystack's hosted checkout, the webhook may
  // take a moment to land — refresh once so the new status shows up
  // without a manual page reload.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "complete") {
      refresh();
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [refresh]);

  const features = [
    { label: "AI conversations / month", starter: "1,000", growth: "5,000", pro: "Unlimited" },
    { label: "Omnichannel support", starter: "WhatsApp only", growth: "WhatsApp, Website, IG", pro: "All channels + API" },
    { label: "Knowledge base sources", starter: "Up to 10 FAQs", growth: "Up to 50 FAQs + 5 PDFs", pro: "Unlimited (dynamic scraping)" },
    { label: "Team seats", starter: "1 user", growth: "3 users", pro: "Unlimited" },
    { label: "Response latency", starter: "Standard", growth: "Priority reasoning", pro: "Dedicated model engine" },
  ];

  const handleSelectPlan = async (planCode: string) => {
    setError(null);
    setCheckingOut(planCode);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't start checkout. Please try again.");
        setCheckingOut(null);
        return;
      }
      const { authorizationUrl } = await res.json();
      window.location.href = authorizationUrl;
    } catch {
      setError("Couldn't start checkout. Please check your connection and try again.");
      setCheckingOut(null);
    }
  };

  const isCurrentPlan = (planCode: string) =>
    subscription?.plan === planCode && ["trialing", "active", "past_due"].includes(subscription.status);

  return (
    <div>
      <div className="bill-page-head">
        <div className="eyebrow">
          <span className="dot"></span> BILLING
        </div>
        <h1>Billing</h1>
      </div>

      {subscription && (
        <div className="card" style={{ padding: "18px 22px", marginBottom: 22, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Current status</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{STATUS_LABELS[subscription.status] ?? subscription.status}</div>
          </div>
          {subscription.status === "trialing" && subscription.trialEndsAt && (
            <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>Trial ends {formatDate(subscription.trialEndsAt)}</div>
          )}
          {subscription.status === "active" && subscription.currentPeriodEnd && (
            <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>Renews {formatDate(subscription.currentPeriodEnd)}</div>
          )}
        </div>
      )}

      {usage && (
        <div className="card" style={{ padding: "18px 22px", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              AI conversations this month
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: USAGE_LEVEL_COLOR[usage.level] }}>
              {usage.unlimited ? `${usage.used.toLocaleString()} used` : `${usage.used.toLocaleString()} / ${usage.cap.toLocaleString()}`}
            </div>
          </div>
          {!usage.unlimited && (
            <div style={{ marginTop: 10, height: 8, borderRadius: 999, background: "var(--border)", overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.min(100, usage.pct)}%`,
                  height: "100%",
                  background: USAGE_LEVEL_COLOR[usage.level],
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          )}
          {USAGE_LEVEL_MESSAGE[usage.level] && (
            <div style={{ marginTop: 10, fontSize: 13, color: USAGE_LEVEL_COLOR[usage.level] }}>
              {USAGE_LEVEL_MESSAGE[usage.level]}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="card" style={{ padding: "12px 18px", marginBottom: 22, borderColor: "var(--rust)", color: "var(--rust)" }}>
          {error}
        </div>
      )}

      <div className="bill-plans">
        {plans.map((p) => {
          const isActive = isCurrentPlan(p.code);
          return (
            <div key={p.code} className={`bill-plan-card ${isActive ? "active" : ""}`}>
              <div className="bill-plan-top">
                <span className="bill-plan-name">{p.name}</span>
                {isActive && <span className="badge badge-green">Current plan</span>}
              </div>
              <div className="bill-plan-price">
                {p.price} <span>/ month</span>
              </div>
              <button
                className="bill-plan-btn"
                onClick={() => handleSelectPlan(p.code)}
                disabled={checkingOut !== null}
              >
                {checkingOut === p.code ? "Redirecting to Paystack…" : isActive ? "Renew now" : "Choose plan"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="card bill-table-card">
        <div className="card-head">
          <h3>Compare plans</h3>
        </div>
        <table className="bill-table">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Starter</th>
              <th>Growth</th>
              <th>Pro</th>
            </tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <tr key={f.label}>
                <td>{f.label}</td>
                <td>{f.starter}</td>
                <td>{f.growth}</td>
                <td>{f.pro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="bill-card-title">Payment method</div>
          <div style={{ padding: "12px 0", color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.6 }}>
            {subscription?.status === "active" || subscription?.status === "past_due"
              ? "Payments are handled by Paystack at checkout — card details aren't stored or shown here."
              : "No payment on file yet. Choose a plan above to check out with Paystack."}
          </div>
        </div>

        <div className="card">
          <div className="bill-card-title">Invoice history</div>
          <div style={{ padding: "12px 0", color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.6 }}>
            Not available yet — this needs invoice records synced from Paystack, which hasn&apos;t been built. Nothing shown here is invented.
          </div>
        </div>
      </div>
    </div>
  );
}
