"use client";

import React from "react";
import "./ai-performance.css";

export default function AIPerformancePage() {
  const kpis = [
    { label: "AI Resolution Rate", value: "94.2%", desc: "Resolved without a human", target: "90% target" },
    { label: "Escalation Rate", value: "5.8%", desc: "Passed to human staff", target: "10% target" },
    { label: "Avg. Response Time", value: "1.8s", desc: "Latency per message", target: "< 2s target" },
    { label: "AI Sales Conversion", value: "12.4%", desc: "Influenced purchase count", target: "10% target" },
  ];

  const escalationReasons = [
    { reason: "Missing catalog item details", pct: 45, count: 18 },
    { reason: "Custom pricing negotiations", pct: 30, count: 12 },
    { reason: "Shipping cost overrides", pct: 15, count: 6 },
    { reason: "General support complaints", pct: 10, count: 4 },
  ];

  const satisfactionTrends = [
    { label: "MON", score: 4.2 },
    { label: "TUE", score: 4.4 },
    { label: "WED", score: 4.1 },
    { label: "THU", score: 4.5 },
    { label: "FRI", score: 4.6 },
    { label: "SAT", score: 4.4 },
    { label: "SUN", score: 4.5 },
  ];
  const maxScore = Math.max(...satisfactionTrends.map((t) => t.score));

  return (
    <div>
      <div className="aip-page-head">
        <div className="eyebrow">
          <span className="dot"></span> REASONING & ALIGNMENT
        </div>
        <h1>AI Performance</h1>
      </div>

      <div className="kpi-strip">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="kpi-card">
            <div className="kpi-label">{kpi.label}</div>
            <div className="kpi-value">{kpi.value}</div>
            <div className="aip-kpi-desc">{kpi.desc}</div>
            <span className="badge badge-green">{kpi.target}</span>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h3>Escalation reasons</h3>
          </div>
          <div>
            {escalationReasons.map((esc, i) => (
              <div key={i} className="aip-esc-row">
                <div className="aip-esc-info">
                  <span className="aip-esc-reason">{esc.reason}</span>
                  <span className="aip-esc-count">{esc.count} handoffs</span>
                </div>
                <div className="aip-esc-value">
                  <div className="aip-esc-track">
                    <div className="aip-esc-fill" style={{ width: `${esc.pct}%` }} />
                  </div>
                  <span className="aip-esc-pct">{esc.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>CSAT, daily</h3>
            <span className="badge badge-green">Avg 4.4 / 5</span>
          </div>
          <div className="bars">
            {satisfactionTrends.map((t, i) => (
              <div
                key={i}
                className={`bar ${t.score === maxScore ? "peak" : ""}`}
                style={{ height: `${(t.score / 5) * 100}%` }}
                title={`${t.label}: ${t.score}/5`}
              />
            ))}
          </div>
          <div className="bar-labels">
            {satisfactionTrends.map((t, i) => (
              <span key={i}>{t.label}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Alignment actions</h3>
        </div>
        <div>
          <div className="insight">
            <div className="insight-tag">Missing product data</div>
            <p>
              45% of escalations happened because the Dell XPS laptop was missing exact sizing/RAM attributes in its catalog description.
            </p>
            <a href="/dashboard/products" className="insight-action">
              Update product attributes →
            </a>
          </div>
          <div className="insight">
            <div className="insight-tag">Warranty coverage gap</div>
            <p>
              Customers asked 12 times this week about repair warranties — the AI lacked context and fell back to generic replies.
            </p>
            <a href="/dashboard/knowledge" className="insight-action">
              Define a warranty FAQ →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
