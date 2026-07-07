"use client";

import React from "react";
import { useSubscription } from "@/components/providers/SubscriptionProvider";
import "./billing.css";

export default function BillingPage() {
  const { subscription, refresh } = useSubscription();
  const currentPlan = subscription?.status === "active" ? subscription.plan : null;

  const plans = [
    { id: "starter", name: "Starter", price: "₦15,000" },
    { id: "growth", name: "Growth", price: "₦45,000" },
    { id: "pro", name: "Pro", price: "₦150,000" },
  ];

  const features = [
    { label: "AI conversations / month", starter: "1,000", growth: "5,000", pro: "Unlimited" },
    { label: "Omnichannel support", starter: "WhatsApp only", growth: "WhatsApp, Website, IG", pro: "All channels + API" },
    { label: "Knowledge base sources", starter: "Up to 10 FAQs", growth: "Up to 50 FAQs + 5 PDFs", pro: "Unlimited (dynamic scraping)" },
    { label: "Team seats", starter: "1 user", growth: "3 users", pro: "Unlimited" },
    { label: "Response latency", starter: "Standard", growth: "Priority reasoning", pro: "Dedicated model engine" },
  ];

  const invoices = [
    { id: "MIDE-2026-003", date: "June 1, 2026", amount: "₦150,000" },
    { id: "MIDE-2026-002", date: "May 1, 2026", amount: "₦150,000" },
    { id: "MIDE-2026-001", date: "April 1, 2026", amount: "₦15,000" },
  ];

  const handleSelectPlan = async (planId: string) => {
    // Simulates a successful Paystack/Flutterwave checkout
    document.cookie = `midevela_mock_status=active; path=/; max-age=86400`;
    document.cookie = `midevela_mock_plan=${planId}; path=/; max-age=86400`;
    await refresh();
  };

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
          const isActive = currentPlan === p.id;
          return (
            <div key={p.id} className={`bill-plan-card ${isActive ? "active" : ""}`}>
              <div className="bill-plan-top">
                <span className="bill-plan-name">{p.name}</span>
                {isActive && <span className="badge badge-green">Active</span>}
              </div>
              <div className="bill-plan-price">
                {p.price} <span>/ month</span>
              </div>
              <button className="bill-plan-btn" onClick={() => handleSelectPlan(p.id)}>
                {isActive ? "Manage subscription" : "Upgrade plan"}
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
          <div className="bill-payment-row">
            <span className="bill-card-icon">💳</span>
            <div className="bill-payment-info">
              <span className="bill-payment-name">Mastercard ending in 4242</span>
              <span className="bill-payment-sub">Expires 12 / 2028</span>
            </div>
            <span className="badge badge-green">Default</span>
          </div>
          <button className="btn-outline" style={{ marginTop: 14 }}>Update card</button>
        </div>

        <div className="card">
          <div className="bill-card-title">Invoice history</div>
          <div>
            {invoices.map((inv) => (
              <div key={inv.id} className="bill-invoice-row">
                <div>
                  <div className="bill-invoice-name">Invoice #{inv.id}</div>
                  <div className="bill-invoice-sub">{inv.date} · {inv.amount}</div>
                </div>
                <span className="badge badge-green">Paid</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
