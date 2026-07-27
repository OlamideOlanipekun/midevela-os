"use client";

import type { MerchantAIData } from "@/lib/merchant/types";
import { MerchantStats } from "@/components/merchant/MerchantStats";

interface AITabProps {
  data: MerchantAIData | null;
}

export function AITab({ data }: AITabProps) {
  if (!data) {
    return <p className="text-sm text-ink-soft">No AI data available yet.</p>;
  }

  const stats = [
    { label: "Avg Confidence", value: `${data.avgConfidence}%` },
    { label: "Hallucination Rate", value: `${data.hallucinationRate}%` },
    { label: "Response Time", value: `${data.responseTime}s` },
    { label: "Knowledge Coverage", value: `${data.knowledgeCoverage}%` },
    { label: "Escalations", value: data.escalations.toLocaleString() },
    { label: "Fallback Rate", value: `${data.fallbackRate}%` },
  ];

  const barMetrics = [
    { label: "Avg Confidence", value: data.avgConfidence, color: "#22c55e" },
    { label: "Knowledge Coverage", value: data.knowledgeCoverage, color: "#3b82f6" },
    { label: "Response Time", value: Math.max(0, 100 - data.responseTime * 20), color: "#eab308", display: `${data.responseTime}s` },
    { label: "Fallback Rate", value: Math.max(0, 100 - data.fallbackRate), invert: true, color: "#f97316", display: `${data.fallbackRate}%` },
  ];

  return (
    <div>
      <MerchantStats stats={stats} />

      <div className="stat-card mt-4">
        <h3 className="stat-title">AI Performance Metrics</h3>
        <div className="ai-grid mt-2">
          {barMetrics.map((m) => (
            <div key={m.label} className="ai-metric">
              <div className="ai-metric-header">
                <span className="ai-metric-label">{m.label}</span>
                <span className="ai-metric-val">{m.display || `${m.value}%`}</span>
              </div>
              <div className="ai-bar-track">
                <div className="ai-bar-fill" style={{ width: `${Math.min(m.value, 100)}%`, backgroundColor: m.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {data.failures.length > 0 && (
        <div className="stat-card mt-4">
          <h3 className="stat-title">Recent AI Failures</h3>
          <div className="af-list">
            {data.failures.slice(0, 5).map((f) => (
              <div key={f.id} className="af-item">
                <div className="af-query">
                  <span className="af-label">Customer asked:</span>
                  <p className="af-text">{f.query}</p>
                </div>
                <div className="af-reason">
                  <span className="af-label">AI failed because:</span>
                  <p className="af-text">{f.reason}</p>
                </div>
                <div className="af-date text-xs text-ink-soft">{new Date(f.date).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
