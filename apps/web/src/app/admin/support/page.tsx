"use client";
export default function AdminSupport() {
  return <div><div className="admin-page-head"><h1>Support</h1><p>Tickets from merchants across the platform. Impersonate to resolve.</p></div>
    <div className="admin-metrics">
      <div className="admin-metric-card"><div className="admin-metric-label">Open</div><div className="admin-metric-value">12</div></div>
      <div className="admin-metric-card"><div className="admin-metric-label">Pending</div><div className="admin-metric-value">8</div></div>
      <div className="admin-metric-card"><div className="admin-metric-label">Resolved Today</div><div className="admin-metric-value">24</div></div>
    </div>
    <div className="admin-card"><div className="admin-card-body" style={{ padding: 40, textAlign: "center", color: "var(--admin-text-muted)" }}>Support ticket system coming soon.</div></div>
  </div>;
}
