"use client";

import type { AIHealthData } from "@/lib/dashboard/types";

interface Props {
  data: AIHealthData;
}

const metrics = [
  { label: "Avg Confidence", key: "avgConfidence", suffix: "%", color: "#22c55e" },
  { label: "Hallucination Rate", key: "hallucinationRate", suffix: "%", invert: true, color: "#eab308" },
  { label: "Response Time", key: "responseTime", suffix: "s", color: "#3b82f6" },
  { label: "Fallback Rate", key: "fallbackRate", suffix: "%", invert: true, color: "#f97316" },
];

export function AIHealth({ data }: Props) {
  return (
    <div className="stat-card">
      <h3 className="stat-title">AI Health</h3>
      <div className="ai-grid">
        {metrics.map((m) => {
          const val = data[m.key as keyof AIHealthData] as number;
          const pct = m.invert ? 100 - val : val;
          return (
            <div key={m.key} className="ai-metric">
              <div className="ai-metric-header">
                <span className="ai-metric-label">{m.label}</span>
                <span className="ai-metric-val">{val}{m.suffix}</span>
              </div>
              <div className="ai-bar-track">
                <div
                  className="ai-bar-fill"
                  style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: m.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
