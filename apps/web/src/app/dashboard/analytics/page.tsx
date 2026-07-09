"use client";

import React, { useEffect, useState } from "react";
import "./analytics.css";

interface AnalyticsSummary {
  totalConversations: number;
  totalCustomers: number;
  avgConfidence: number;
  topIntent: { label: string; color: string; pct: number } | null;
  funnelStages: Array<{ label: string; count: number; widthPct: number }>;
  intentSegments: Array<{ label: string; color: string; pct: number }>;
  topProducts: Array<{ name: string; count: number; widthPct: number }>;
  dailyConversations: number[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((res) => res.json())
      .then((summary) => setData(summary))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <div className="an-page-head">
          <div>
            <div className="eyebrow"><span className="dot"></span> PERFORMANCE</div>
            <h1>Analytics</h1>
          </div>
        </div>
        <div style={{ padding: 60, textAlign: "center", color: "var(--ink-soft)" }}>Loading analytics…</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <div className="an-page-head">
          <div>
            <div className="eyebrow"><span className="dot"></span> PERFORMANCE</div>
            <h1>Analytics</h1>
          </div>
        </div>
        <div className="card" style={{ padding: 60, textAlign: "center", color: "var(--ink-soft)" }}>
          Couldn&apos;t load analytics right now. Try refreshing.
        </div>
      </div>
    );
  }

  const kpis = [
    { label: "Conversations", value: String(data.totalConversations) },
    { label: "Customers", value: String(data.totalCustomers) },
    { label: "Avg. AI confidence", value: `${data.avgConfidence}%` },
    {
      label: "Top intent",
      value: data.topIntent ? `${data.topIntent.label}` : "No data yet",
      sub: data.topIntent ? `${data.topIntent.pct}% of conversations` : undefined,
    },
  ];

  const maxDaily = Math.max(1, ...data.dailyConversations);

  return (
    <div>
      <div className="an-page-head">
        <div>
          <div className="eyebrow">
            <span className="dot"></span> PERFORMANCE
          </div>
          <h1>Analytics</h1>
        </div>
      </div>

      <div className="kpi-strip">
        {kpis.map((kpi, i) => (
          <div key={i} className="kpi-card">
            <div className="kpi-label">{kpi.label}</div>
            <div className="kpi-value">{kpi.value}</div>
            {kpi.sub && <div className="kpi-delta up">{kpi.sub}</div>}
          </div>
        ))}
      </div>

      {data.totalConversations === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: "center", color: "var(--ink-soft)" }}>
          No conversations yet — once your widget is live and visitors start chatting, this page fills in with real activity.
        </div>
      ) : (
        <>
          <div className="grid-2">
            <div className="card">
              <div className="card-head">
                <h3>Buying-stage funnel</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.funnelStages.map((stage, i) => (
                  <div key={i} className="funnel-row">
                    <div className="funnel-label">{stage.label}</div>
                    <div className="funnel-bar-track">
                      <div
                        className={`funnel-bar-fill ${i === data.funnelStages.length - 1 ? "final" : ""}`}
                        style={{ width: `${stage.widthPct}%` }}
                      />
                    </div>
                    <div className="funnel-pct mono">{stage.count}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h3>Conversations, last 7 days</h3>
              </div>
              <div className="bars">
                {data.dailyConversations.map((count, i) => (
                  <div
                    key={i}
                    className={`bar ${count === maxDaily && count > 0 ? "peak" : ""}`}
                    style={{ height: `${Math.round((count / maxDaily) * 100)}%` }}
                    title={`${count} conversation${count === 1 ? "" : "s"}`}
                  />
                ))}
              </div>
              <div className="bar-labels">
                {data.dailyConversations.map((_, i) => (
                  <span key={i}>D{i + 1}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="card-head">
                <h3>Top recommended products</h3>
              </div>
              <div>
                {data.topProducts.length === 0 ? (
                  <div style={{ padding: 20, color: "var(--ink-soft)" }}>No products recommended yet.</div>
                ) : (
                  data.topProducts.map((p, i) => (
                    <div key={i} className="an-rank-row">
                      <span className="an-rank-num">0{i + 1}</span>
                      <div className="an-rank-info">
                        <span className="an-rank-name">{p.name}</span>
                        <span className="an-rank-sub">Recommended {p.count}×</span>
                      </div>
                      <div className="an-rank-value">
                        <div className="an-rank-track">
                          <div className="an-rank-fill" style={{ width: `${p.widthPct}%` }} />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h3>Customer intent</h3>
              </div>
              <div>
                {data.intentSegments.length === 0 ? (
                  <div style={{ padding: 20, color: "var(--ink-soft)" }}>No conversations classified yet.</div>
                ) : (
                  data.intentSegments.map((seg) => (
                    <div key={seg.label} className="an-intent-row">
                      <div className="an-intent-key">
                        <span className="an-intent-swatch" style={{ background: seg.color }} />
                        <span className="an-intent-label">{seg.label}</span>
                      </div>
                      <span className="an-intent-pct" style={{ color: seg.color }}>{seg.pct}%</span>
                      <div className="an-intent-track">
                        <div className="an-intent-fill" style={{ width: `${seg.pct}%`, background: seg.color }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
