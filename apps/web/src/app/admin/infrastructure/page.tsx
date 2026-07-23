"use client";
export default function AdminInfrastructure() {
  return <div><div className="admin-page-head"><h1>Infrastructure</h1><p>CPU, RAM, Redis, queue workers, and cron jobs in real time.</p></div>
    <div className="admin-metrics">
      <div className="admin-metric-card"><div className="admin-metric-label">CPU</div><div className="admin-metric-value">34%</div></div>
      <div className="admin-metric-card"><div className="admin-metric-label">Memory</div><div className="admin-metric-value">2.8 / 8 GB</div></div>
      <div className="admin-metric-card"><div className="admin-metric-label">Redis</div><div className="admin-metric-value">Online</div><div className="admin-metric-sub">12.4k keys</div></div>
      <div className="admin-metric-card"><div className="admin-metric-label">Queue</div><div className="admin-metric-value">234</div><div className="admin-metric-sub">pending jobs</div></div>
    </div>
    <div className="admin-card"><div className="admin-card-body" style={{ padding: 40, textAlign: "center", color: "var(--admin-text-muted)" }}>Infrastructure dashboard coming soon.</div></div>
  </div>;
}
