"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import "./dashboard.css";

interface Overview {
  kpis: Array<{ label: string; value: string; sub: string }>;
  activeConversations: number;
  funnel: Array<{ label: string; count: number; widthPct: number }>;
  dailyConversations: number[];
  avgConfidence: number;
  recentActivity: Array<{ id: string; name: string; text: string; meta: string; color: string }>;
  insights: Array<{ tag: string; text: string; action: string; href: string }>;
}

interface Readiness {
  score: number;
  ready: boolean;
  items: Array<{ key: string; label: string; status: "pass" | "warn" | "missing"; detail: string }>;
  counts: { products: number; categories: number; conversations: number };
}

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export default function DashboardHome() {
  const { user } = useAuth();
  const router = useRouter();

  const userName = user?.name || user?.email || "there";
  const firstName = userName.split(" ")[0];

  const [greeting, setGreeting] = useState(`Good afternoon, ${firstName}.`);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [readiness, setReadiness] = useState<Readiness | null>(null);

  useEffect(() => {
    const hours = new Date().getHours();
    let greet = "Good morning";
    if (hours >= 12 && hours < 17) greet = "Good afternoon";
    else if (hours >= 17) greet = "Good evening";
    setGreeting(`${greet}, ${firstName}.`);
  }, [firstName]);

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard/overview")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active) setData(json);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    fetch("/api/health/readiness")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active) setReadiness(json);
      })
      .catch(() => {
        if (active) setReadiness(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleQuickAction = (actionName: string) => {
    if (actionName === "Add Product") {
      router.push("/dashboard/products?action=add");
    } else if (actionName === "Import Catalog") {
      router.push("/dashboard/knowledge?tab=docs");
    } else if (actionName === "Launch Automation" || actionName === "Broadcast Campaign") {
      setToastMessage(`${actionName} isn't available yet — it's on the roadmap, not built.`);
      setTimeout(() => setToastMessage(null), 3500);
    } else if (actionName === "Invite Team Member") {
      router.push("/dashboard/settings?tab=team");
    } else if (actionName === "Connect Integration") {
      router.push("/dashboard/settings?tab=org");
    }
  };

  // 7-day bars scaled to the busiest day; a flat/empty week reads as empty.
  const daily = data?.dailyConversations ?? [];
  const dailyMax = Math.max(1, ...daily);

  // AI-confidence ring geometry (r=36 → circumference ≈ 226).
  const ringCirc = 226;
  const ringOffset = ringCirc * (1 - (data?.avgConfidence ?? 0) / 100);

  return (
    <div className="flex flex-col gap-xl" style={{ position: "relative" }}>
      {toastMessage && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px", background: "var(--ink)",
          color: "var(--paper)", padding: "12px 24px", borderRadius: "var(--radius-pill)",
          border: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: "12px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)", zIndex: 1000, animation: "fadeIn 0.2s ease",
        }}>
          ⚡ {toastMessage}
        </div>
      )}

      {/* Page Head */}
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <span className="dot"></span> WORKSPACE OVERVIEW
          </div>
          <h1 className="display">{greeting}</h1>
        </div>
        {data && (
          <div className="live-pill">
            <span className="pulse"></span>
            {data.activeConversations} active conversation{data.activeConversations === 1 ? "" : "s"}
          </div>
        )}
      </div>

      {/* KPI STRIP */}
      <div className="kpi-strip">
        {(loading ? Array.from({ length: 6 }) : data?.kpis ?? []).map((kpi, idx) => {
          const k = kpi as Overview["kpis"][number] | undefined;
          return (
            <div key={idx} className="kpi-card">
              <div className="kpi-label">{k ? k.label : "—"}</div>
              <div className="kpi-value mono">{k ? k.value : "…"}</div>
              <div className="kpi-delta" style={{ color: "var(--ink-soft)" }}>{k ? k.sub : ""}</div>
            </div>
          );
        })}
      </div>

      {/* Two Column Section */}
      <div className="grid-2">
        {/* Live Activity Feed — real recent conversations */}
        <div className="card">
          <div className="card-head">
            <h3>Recent Activity</h3>
            <Link href="/dashboard/conversations" className="view-all">View all →</Link>
          </div>

          {loading ? (
            <div style={{ padding: "20px 0", color: "var(--ink-soft)", fontSize: 13 }}>Loading…</div>
          ) : data && data.recentActivity.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {data.recentActivity.map((activity) => (
                <div key={activity.id} className="feed-item" style={{ cursor: "pointer" }} onClick={() => router.push("/dashboard/conversations")}>
                  <div className={`feed-dot ${activity.color}`}></div>
                  <div>
                    <div className="feed-text">
                      <strong style={{ fontWeight: 600 }}>{activity.name} </strong>
                      {activity.text}
                    </div>
                    <div className="feed-time">{activity.meta}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: "24px 0", color: "var(--ink-soft)", fontSize: 13, lineHeight: 1.6 }}>
              No conversations yet. Once shoppers start chatting with your widget, their activity shows up here.
            </div>
          )}
        </div>

        {/* AI Insights — derived from real signals */}
        <div className="card">
          <div className="card-head">
            <h3>Insights</h3>
            <span className="view-all" style={{ cursor: "pointer" }} onClick={() => router.push("/dashboard/analytics")}>View all →</span>
          </div>

          <div>
            {loading ? (
              <div style={{ padding: "20px 0", color: "var(--ink-soft)", fontSize: 13 }}>Loading…</div>
            ) : (
              (data?.insights ?? []).map((insight, idx) => (
                <div key={idx} className="insight">
                  <div className="insight-tag">{insight.tag}</div>
                  <p>{insight.text}</p>
                  <button className="insight-action" onClick={() => router.push(insight.href)}>{insight.action}</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Widget Health & Launch Checklist — same real readiness signals used in onboarding */}
      {readiness && (
        <div className="grid-2">
          <div className="card">
            <div className="card-head">
              <h3>Widget health</h3>
              <span className="view-all" style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: readiness.ready ? "var(--teal)" : "var(--amber)" }}>
                {readiness.score}%
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {readiness.items.map((it) => (
                <div key={it.key} style={{ display: "flex", gap: 10, fontSize: 13, alignItems: "flex-start" }}>
                  <span>{it.status === "pass" ? "✅" : it.status === "warn" ? "⚠️" : "⛔"}</span>
                  <span><b>{it.label}</b> <span style={{ color: "var(--ink-soft)" }}>— {it.detail}</span></span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Launch checklist</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Products added", done: readiness.counts.products > 0, href: "/dashboard/products" },
                { label: "Categories set up", done: readiness.counts.categories > 0, href: "/dashboard/categories" },
                { label: "First conversation", done: readiness.counts.conversations > 0, href: "/dashboard/conversations" },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, cursor: item.done ? "default" : "pointer" }}
                  onClick={() => !item.done && router.push(item.href)}
                >
                  <span style={{
                    width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${item.done ? "var(--teal)" : "var(--line)"}`,
                    background: item.done ? "var(--teal)" : "transparent", color: "#fff", display: "flex",
                    alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0,
                  }}>
                    {item.done ? "✓" : ""}
                  </span>
                  <span style={{ color: item.done ? "var(--ink)" : "var(--ink-soft)", textDecoration: item.done ? "none" : "underline" }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Grid 3 Widgets */}
      <div className="grid-3">
        {/* Conversations, 7 Days */}
        <div className="card">
          <div className="card-head">
            <h3>Conversations, 7 Days</h3>
          </div>
          <div className="bars">
            {daily.map((count, idx) => {
              const h = Math.round((count / dailyMax) * 100);
              return (
                <div
                  key={idx}
                  className={`bar ${count > 0 && count === dailyMax ? "peak" : ""}`}
                  style={{ height: `${count > 0 ? Math.max(h, 6) : 2}%` }}
                  title={`${count} conversation${count === 1 ? "" : "s"}`}
                />
              );
            })}
          </div>
          <div className="bar-labels">
            {DAY_LABELS.map((d) => <span key={d}>{d}</span>)}
          </div>
        </div>

        {/* Buying-stage Funnel */}
        <div className="card">
          <div className="card-head">
            <h3>Buying-stage Funnel</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "6px" }}>
            {(data?.funnel ?? []).map((stage, idx) => (
              <div key={idx} className="funnel-row">
                <div className="funnel-label">{stage.label}</div>
                <div className="funnel-bar-track">
                  <div
                    className={`funnel-bar-fill ${idx === (data?.funnel.length ?? 0) - 1 ? "final" : ""}`}
                    style={{ width: `${stage.widthPct}%` }}
                  />
                </div>
                <div className="funnel-pct mono">{stage.count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Confidence Ring */}
        <div className="card">
          <div className="card-head">
            <h3>AI Confidence</h3>
          </div>
          <div className="health-wrap">
            <svg className="health-ring" viewBox="0 0 84 84">
              <circle cx="42" cy="42" r="36" fill="none" stroke="var(--line)" strokeWidth="8" />
              <circle cx="42" cy="42" r="36" fill="none" stroke="var(--teal)" strokeWidth="8"
                strokeDasharray={ringCirc} strokeDashoffset={ringOffset} strokeLinecap="round"
                transform="rotate(-90 42 42)" />
            </svg>
            <div className="health-text">
              <div className="h-num mono">{data ? `${data.avgConfidence}%` : "—"}</div>
              <div className="h-label">Average AI confidence<br />across conversations</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Row */}
      <div className="card">
        <div className="card-head">
          <h3>Quick Actions</h3>
        </div>
        <div className="quick-actions">
          {[
            { label: "Add product", action: "Add Product", icon: <><path d="M12 5v14" /><path d="M5 12h14" /></> },
            { label: "Import catalog", action: "Import Catalog", icon: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></> },
            { label: "Launch automation", action: "Launch Automation", icon: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /> },
            { label: "Broadcast campaign", action: "Broadcast Campaign", icon: <><path d="M4 4h16v12H7l-3 3z" /></> },
            { label: "Invite team member", action: "Invite Team Member", icon: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></> },
            { label: "Connect integration", action: "Connect Integration", icon: <><path d="M18 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" /><path d="M6 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" /><path d="M8.6 16.4 15.4 7.6" /></> },
          ].map((qa) => (
            <button key={qa.action} className="qa-btn" onClick={() => handleQuickAction(qa.action)}>
              <span className="qa-ico">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  {qa.icon}
                </svg>
              </span>
              <span className="qa-label">{qa.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
