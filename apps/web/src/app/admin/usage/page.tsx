"use client";
export default function AdminUsage() {
  return <div><div className="admin-page-head"><h1>Usage</h1><p>Platform-wide metrics: messages, tokens, storage, API calls.</p></div>
    <div className="admin-metrics">
      <div className="admin-metric-card"><div className="admin-metric-label">Messages Today</div><div className="admin-metric-value">48,290</div></div>
      <div className="admin-metric-card"><div className="admin-metric-label">Tokens Used</div><div className="admin-metric-value">12.4M</div></div>
      <div className="admin-metric-card"><div className="admin-metric-label">API Calls</div><div className="admin-metric-value">94,201</div></div>
      <div className="admin-metric-card"><div className="admin-metric-label">Storage Used</div><div className="admin-metric-value">2.1 GB</div></div>
    </div>
    <div className="admin-card"><div className="admin-card-body" style={{ padding: 40, textAlign: "center", color: "var(--admin-text-muted)" }}>Usage charts coming soon.</div></div>
  </div>;
}
