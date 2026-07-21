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

export default function BillingPage() {
  const { subscription } = useSubscription();
  const [plans, setPlans] = useState<Plan[]>([]);
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

  const features = [
    { label: "AI conversations / month", starter: "Coming soon", growth: "Coming soon", pro: "Coming soon" },
    { label: "Omnichannel support", starter: "Coming soon", growth: "Coming soon", pro: "Coming soon" },
    { label: "Knowledge base sources", starter: "Coming soon", growth: "Coming soon", pro: "Coming soon" },
    { label: "Team seats", starter: "Coming soon", growth: "Coming soon", pro: "Coming soon" },
    { label: "Response latency", starter: "Coming soon", growth: "Coming soon", pro: "Coming soon" },
  ];

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
                Coming soon
              </div>
              <button className="bill-plan-btn" disabled>
                Coming soon
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
            Coming soon
          </div>
        </div>

        <div className="card">
          <div className="bill-card-title">Invoice history</div>
          <div style={{ padding: "12px 0", color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.6 }}>
            Coming soon
          </div>
        </div>
      </div>
    </div>
  );
}
