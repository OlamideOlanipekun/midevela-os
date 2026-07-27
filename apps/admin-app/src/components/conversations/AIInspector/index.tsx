"use client";

import type { AIReasoning } from "@/lib/conversations/types";

interface AIInspectorProps {
  data: AIReasoning | null;
}

export function AIInspector({ data }: AIInspectorProps) {
  if (!data) {
    return (
      <div className="panel-section">
        <h3 className="panel-title">AI Inspector</h3>
        <p className="text-xs text-ink-soft">No AI data available for this message.</p>
      </div>
    );
  }

  return (
    <div className="panel-section">
      <h3 className="panel-title">AI Inspector</h3>

      <div className="panel-fields">
        <div className="panel-field">
          <span className="panel-field-label">Intent</span>
          <span className="panel-field-value capitalize">{data.intent.replace(/_/g, " ")}</span>
        </div>
      </div>

      <h4 className="panel-subtitle">Knowledge Sources</h4>
      <div className="panel-tags">
        {data.knowledgeSources.map((s, i) => (
          <span key={i} className="panel-tag">{s.title}</span>
        ))}
      </div>

      <h4 className="panel-subtitle">Products Considered</h4>
      <div className="panel-list">
        {data.productsConsidered.map((p, i) => (
          <div key={i} className="panel-list-item">
            <span>{p.name}</span>
            <span className="text-xs text-ink-soft">₦{p.price.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <h4 className="panel-subtitle">Products Ranked</h4>
      <div className="panel-list">
        {data.productsRanked.map((p, i) => (
          <div key={i} className="panel-list-item">
            <span>{p.name}</span>
            <span className="text-xs" style={{ color: p.score >= 85 ? "#22c55e" : p.score >= 70 ? "#eab308" : "#f97316" }}>{p.score}%</span>
          </div>
        ))}
      </div>

      {data.recommended && (
        <div className="panel-recommendation">
          <h4 className="panel-subtitle">Recommended</h4>
          <p className="text-sm font-semibold text-teal-deep">{data.recommended.name}</p>
          <p className="text-xs text-ink-soft">{data.recommended.reason}</p>
          <p className="text-xs font-mono mt-1">Confidence: {data.confidence}%</p>
        </div>
      )}
    </div>
  );
}
