"use client";

import React, { useEffect, useState } from "react";
import "./ai-performance.css";

interface AiPerformanceSummary {
  avgResponseSeconds: number | null;
  totalAiMessages: number;
  recommendationRatePct: number;
  fallbackRatePct: number;
  responseTimeBuckets: Array<{ label: string; count: number; pct: number }>;
}

export default function AIPerformancePage() {
  const [data, setData] = useState<AiPerformanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ai-performance")
      .then((res) => res.json())
      .then((summary) => setData(summary))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <div className="aip-page-head">
          <div className="eyebrow"><span className="dot"></span> REASONING & ALIGNMENT</div>
          <h1>AI Performance</h1>
        </div>
        <div style={{ padding: 60, textAlign: "center", color: "var(--ink-soft)" }}>Loading…</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <div className="aip-page-head">
          <div className="eyebrow"><span className="dot"></span> REASONING & ALIGNMENT</div>
          <h1>AI Performance</h1>
        </div>
        <div className="card" style={{ padding: 60, textAlign: "center", color: "var(--ink-soft)" }}>
          Couldn&apos;t load AI performance data right now. Try refreshing.
        </div>
      </div>
    );
  }

  const kpis = [
    {
      label: "Avg. response time",
      value: data.avgResponseSeconds !== null ? `${data.avgResponseSeconds}s` : "—",
      desc: "End-to-end latency per reply",
      target: "< 3s target",
    },
    {
      label: "AI replies sent",
      value: String(data.totalAiMessages),
      desc: "Total messages generated",
      target: null,
    },
    {
      label: "Recommendation rate",
      value: `${data.recommendationRatePct}%`,
      desc: "Replies that included a product",
      target: null,
    },
    {
      label: "Fallback rate",
      value: `${data.fallbackRatePct}%`,
      desc: "Replies where the model's output couldn't be parsed",
      target: "< 5% target",
    },
  ];

  const bucketMax = Math.max(1, ...data.responseTimeBuckets.map((b) => b.count));

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
            {kpi.target && <span className="badge badge-green">{kpi.target}</span>}
          </div>
        ))}
      </div>

      {data.totalAiMessages === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: "center", color: "var(--ink-soft)" }}>
          No AI replies yet — once your widget starts handling real conversations, this page fills in with real performance data.
        </div>
      ) : (
        <>
          <div className="grid-2">
            <div className="card">
              <div className="card-head">
                <h3>Response time distribution</h3>
              </div>
              <div>
                {data.responseTimeBuckets.map((b, i) => (
                  <div key={i} className="aip-esc-row">
                    <div className="aip-esc-info">
                      <span className="aip-esc-reason">{b.label}</span>
                      <span className="aip-esc-count">{b.count} repl{b.count === 1 ? "y" : "ies"}</span>
                    </div>
                    <div className="aip-esc-value">
                      <div className="aip-esc-track">
                        <div className="aip-esc-fill" style={{ width: `${Math.round((b.count / bucketMax) * 100)}%` }} />
                      </div>
                      <span className="aip-esc-pct">{b.pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h3>Customer satisfaction</h3>
              </div>
              <div style={{ padding: "20px 4px", color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.6 }}>
                Not collected yet — this needs an in-widget feedback prompt (e.g. a thumbs up/down after a reply), which hasn&apos;t been built. Nothing shown here is invented.
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Alignment actions</h3>
            </div>
            <div>
              {data.fallbackRatePct > 0 ? (
                <div className="insight">
                  <div className="insight-tag">Fallback replies detected</div>
                  <p>
                    {data.fallbackRatePct}% of AI replies couldn&apos;t produce a structured answer and used a generic
                    fallback message. Expanding your product descriptions and Knowledge Base gives the model more to
                    ground its answers in, which typically reduces this.
                  </p>
                  <a href="/dashboard/knowledge" className="insight-action">
                    Review your Knowledge Base →
                  </a>
                </div>
              ) : (
                <div style={{ padding: "20px 4px", color: "var(--ink-soft)", fontSize: 14 }}>
                  No fallback replies yet — nothing to flag.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
