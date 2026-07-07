"use client";

import React from "react";
import "./analytics.css";

export default function AnalyticsPage() {
  const kpis = [
    { label: "AI-Influenced Revenue", value: "₦4,240,500", delta: "▲ 23.4% this week", type: "up" },
    { label: "Conversion Rate", value: "12.4%", delta: "▲ 2.1% this week", type: "up" },
    { label: "Avg. Order Value", value: "₦47,500", delta: "▲ 8.3% this week", type: "up" },
    { label: "AI Resolution Rate", value: "94.2%", delta: "● 94% target met", type: "up" },
  ];

  const funnelStages = [
    { label: "Visitors", val: "10,000", pct: "100%", width: "100%" },
    { label: "Engaged", val: "4,200", pct: "42%", width: "42%" },
    { label: "Conversations", val: "2,100", pct: "21%", width: "21%" },
    { label: "Recommended", val: "1,400", pct: "14%", width: "14%" },
    { label: "Purchased", val: "1,240", pct: "12.4%", width: "12.4%" },
  ];

  const revenueBars = [60, 45, 80, 55, 90, 70, 95];

  const topProducts = [
    { name: "Ankara Co-ord Set (Burgundy)", count: 284, revenue: "₦8,094,000", pct: 100 },
    { name: "Ankara Flare Gown (Blue)", count: 182, revenue: "₦5,824,000", pct: 64 },
    { name: "HP EliteBook 840 G8 Laptop", count: 98, revenue: "₦47,040,000", pct: 34 },
    { name: "Vitamin C Brightening Serum", count: 85, revenue: "₦1,232,500", pct: 30 },
  ];

  // Categorical: distinct intents, not magnitudes — fixed hue order, never cycled.
  const intentSegments = [
    { label: "Product discovery", pct: 35, color: "var(--teal)" },
    { label: "Specs comparison", pct: 28, color: "var(--blue)" },
    { label: "Purchase intent", pct: 22, color: "var(--amber)" },
    { label: "Support & FAQs", pct: 15, color: "var(--ink-soft)" },
  ];

  return (
    <div>
      <div className="an-page-head">
        <div>
          <div className="eyebrow">
            <span className="dot"></span> PERFORMANCE
          </div>
          <h1>Analytics</h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-outline">Last 7 days</button>
          <button className="btn-outline">Export PDF</button>
        </div>
      </div>

      <div className="kpi-strip">
        {kpis.map((kpi, i) => (
          <div key={i} className="kpi-card">
            <div className="kpi-label">{kpi.label}</div>
            <div className="kpi-value">{kpi.value}</div>
            <div className={`kpi-delta ${kpi.type}`}>{kpi.delta}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h3>Conversion funnel</h3>
            <span className="badge badge-green">52% efficiency</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {funnelStages.map((stage, i) => (
              <div key={i} className="funnel-row">
                <div className="funnel-label">{stage.label}</div>
                <div className="funnel-bar-track">
                  <div
                    className={`funnel-bar-fill ${i === funnelStages.length - 1 ? "final" : ""}`}
                    style={{ width: stage.width }}
                  />
                </div>
                <div className="funnel-pct mono">{stage.val}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>7-day revenue</h3>
            <span className="badge badge-green">+14.2% AOV</span>
          </div>
          <div className="bars">
            {revenueBars.map((h, i) => (
              <div key={i} className={`bar ${h === Math.max(...revenueBars) ? "peak" : ""}`} style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="bar-labels">
            {revenueBars.map((_, i) => (
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
            {topProducts.map((p, i) => (
              <div key={i} className="an-rank-row">
                <span className="an-rank-num">0{i + 1}</span>
                <div className="an-rank-info">
                  <span className="an-rank-name">{p.name}</span>
                  <span className="an-rank-sub">Recommended {p.count}×</span>
                </div>
                <div className="an-rank-value">
                  <span className="an-rank-revenue">{p.revenue}</span>
                  <div className="an-rank-track">
                    <div className="an-rank-fill" style={{ width: `${p.pct}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Customer intent</h3>
          </div>
          <div>
            {intentSegments.map((seg) => (
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
