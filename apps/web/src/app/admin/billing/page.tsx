"use client";
export default function AdminBilling() {
  return <div><div className="admin-page-head"><h1>Billing</h1><p>MRR, ARR, LTV, invoices, and subscription management across all tenants.</p></div>
    <div className="admin-metrics">
      <div className="admin-metric-card"><div className="admin-metric-label">MRR</div><div className="admin-metric-value">$12,840</div></div>
      <div className="admin-metric-card"><div className="admin-metric-label">ARR</div><div className="admin-metric-value">$154,080</div></div>
      <div className="admin-metric-card"><div className="admin-metric-label">Active Subscriptions</div><div className="admin-metric-value">112</div></div>
      <div className="admin-metric-card"><div className="admin-metric-label">Churn Rate</div><div className="admin-metric-value">3.2%</div></div>
    </div>
    <div className="admin-card"><div className="admin-card-body" style={{ padding: 40, textAlign: "center", color: "var(--admin-text-muted)" }}>Billing table and Stripe sync coming soon.</div></div>
  </div>;
}
