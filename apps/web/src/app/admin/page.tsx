"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

interface AdminMetrics {
  activeMerchants: number;
  onlineAgents: number;
  liveConversations: number;
  messagesToday: number;
  recommendations: number;
  handovers: number;
  revenue: string;
  errors: number;
  issues: Array<{ title: string; detail: string; meta: string }>;
  systemStatus: Array<{ name: string; status: "up" | "down" | "degraded" }>;
  recentActivity: Array<{ icon: string; text: string; time: string }>;
}

const defaultMetrics: AdminMetrics = {
  activeMerchants: 0,
  onlineAgents: 0,
  liveConversations: 0,
  messagesToday: 0,
  recommendations: 0,
  handovers: 0,
  revenue: "$0",
  errors: 0,
  issues: [],
  systemStatus: [],
  recentActivity: [],
};

const MetricIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "merchants": return <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></>;
    case "agents": return <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>;
    case "conversations": return <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>;
    case "messages": return <path d="M4 4h16v12H7l-3 3z"/>;
    case "recommendations": return <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>;
    case "handovers": return <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="7" y1="12" x2="17" y2="12"/></>;
    case "revenue": return <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>;
    case "errors": return <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>;
    default: return null;
  }
};

const FeedIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "org": return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
    case "knowledge": return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>;
    case "payment": return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>;
    case "handoff": return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5"/><circle cx="9" cy="7" r="4"/><line x1="7" y1="12" x2="17" y2="12"/></svg>;
    case "widget": return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
    default: return null;
  }
};

export default function AdminMissionControl() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<AdminMetrics>(defaultMetrics);
  const [greeting, setGreeting] = useState("Good morning");

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
    fetch("/admin/api/dashboard")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          d.revenue = `$${d.revenue.toLocaleString()}`;
          setMetrics(d);
        }
      })
      .catch(() => {});
  }, []);

  const firstName = user?.name?.split(" ")[0] || "Olamide";

  const metricCards = [
    { label: "Active Merchants", value: metrics.activeMerchants.toLocaleString(), icon: "merchants" },
    { label: "Online AI Agents", value: metrics.onlineAgents.toLocaleString(), icon: "agents" },
    { label: "Live Conversations", value: metrics.liveConversations.toLocaleString(), icon: "conversations" },
    { label: "Messages Today", value: metrics.messagesToday.toLocaleString(), icon: "messages" },
    { label: "Recommendations", value: metrics.recommendations.toLocaleString(), icon: "recommendations" },
    { label: "Human Handovers", value: metrics.handovers.toLocaleString(), icon: "handovers" },
    { label: "Revenue", value: metrics.revenue, icon: "revenue" },
    { label: "Errors", value: metrics.errors.toLocaleString(), icon: "errors", error: true },
  ];

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>{greeting}, {firstName} 👋</h1>
          <p>Everything looks healthy. {metrics.issues.length > 0 ? `${metrics.issues.length} issue${metrics.issues.length > 1 ? "s" : ""} require attention.` : "All systems nominal."}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--admin-green)", boxShadow: "0 0 8px rgba(34,197,94,0.5)" }}></span>
          <span style={{ fontFamily: "var(--admin-mono)", fontSize: 11, color: "var(--admin-text-soft)" }}>All systems nominal</span>
        </div>
      </div>

      {/* Live Metrics */}
      <div className="admin-metrics">
        {metricCards.map((m) => (
          <div key={m.label} className="admin-metric-card" style={m.error && metrics.errors > 0 ? { borderColor: "rgba(239,68,68,0.3)" } : {}}>
            <div className="admin-metric-label">{m.label}</div>
            <div className="admin-metric-value" style={m.error && metrics.errors > 0 ? { color: "var(--admin-red)" } : {}}>{m.value}</div>
          </div>
        ))}
      </div>

      <div className="admin-grid-2" style={{ marginBottom: 24 }}>
        {/* System Status */}
        <div className="admin-card">
          <div className="admin-card-head"><h3>System Status</h3></div>
          <div className="admin-card-body">
            <div className="admin-status-list">
              {metrics.systemStatus.map((s) => (
                <div key={s.name} className="admin-status-item">
                  <span className="admin-status-name">{s.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className={`admin-status-dot ${s.status}`}></span>
                    <span style={{ fontFamily: "var(--admin-mono)", fontSize: 11, color: s.status === "up" ? "var(--admin-green)" : s.status === "down" ? "var(--admin-red)" : "var(--admin-yellow)" }}>
                      {s.status === "up" ? "Healthy" : s.status === "down" ? "Down" : "Degraded"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="admin-card">
          <div className="admin-card-head"><h3>Recent Activity</h3></div>
          <div className="admin-card-body">
            <div className="admin-feed">
              {metrics.recentActivity.map((a, i) => (
                <div key={i} className="admin-feed-item">
                  <div className="admin-feed-icon"><FeedIcon type={a.icon} /></div>
                  <div>
                    <div className="admin-feed-text">{a.text}</div>
                    <div className="admin-feed-time">{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Issues */}
      {metrics.issues.length > 0 && (
        <div className="admin-card" style={{ borderColor: "rgba(239,68,68,0.2)" }}>
          <div className="admin-card-head">
            <h3 style={{ color: "var(--admin-red)" }}>Issues Requiring Attention</h3>
            <span style={{ fontFamily: "var(--admin-mono)", fontSize: 11, color: "var(--admin-text-muted)" }}>{metrics.issues.length} open</span>
          </div>
          <div className="admin-card-body">
            <div className="admin-issues">
              {metrics.issues.map((issue, i) => (
                <div key={i} className="admin-issue-item">
                  <div className="admin-issue-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  </div>
                  <div className="admin-issue-text">
                    <strong>{issue.title}</strong> — {issue.detail}
                  </div>
                  <div className="admin-issue-meta">{issue.meta}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
