"use client";
export default function AdminModeration() {
  return <div><div className="admin-page-head"><h1>Moderation</h1><p>Flagged conversations, abuse reports, and unsafe AI outputs.</p></div>
    <div className="admin-metrics">
      <div className="admin-metric-card"><div className="admin-metric-label">Flagged Today</div><div className="admin-metric-value">3</div></div>
      <div className="admin-metric-card"><div className="admin-metric-label">Pending Review</div><div className="admin-metric-value">7</div></div>
      <div className="admin-metric-card"><div className="admin-metric-label">Auto-Resolved</div><div className="admin-metric-value">142</div></div>
    </div>
    <div className="admin-card"><div className="admin-card-body" style={{ padding: 40, textAlign: "center", color: "var(--admin-text-muted)" }}>Moderation queue coming soon.</div></div>
  </div>;
}
