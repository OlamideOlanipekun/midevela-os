"use client";

import type { RecommendationData } from "@/lib/conversations/types";

interface RecommendationPanelProps {
  data: RecommendationData | null;
}

export function RecommendationPanel({ data }: RecommendationPanelProps) {
  if (!data) {
    return (
      <div className="panel-section">
        <h3 className="panel-title">Recommendations</h3>
        <p className="text-xs text-ink-soft">No recommendation data available.</p>
      </div>
    );
  }

  return (
    <div className="panel-section">
      <h3 className="panel-title">Recommendation Funnel</h3>

      <div className="rec-funnel">
        <div className="rec-step">
          <span className="rec-step-label">Products Considered</span>
          <span className="rec-step-value">{data.productsConsidered.length}</span>
        </div>
        <div className="rec-arrow">↓</div>
        <div className="rec-step">
          <span className="rec-step-label">Products Ranked</span>
          <span className="rec-step-value">{data.productsRanked.length}</span>
        </div>
        <div className="rec-arrow">↓</div>
        <div className="rec-step">
          <span className="rec-step-label">Product Sent</span>
          <span className="rec-step-value">{data.productSent || "—"}</span>
        </div>
        <div className="rec-arrow">↓</div>
        <div className="rec-step">
          <span className="rec-step-label">Customer Clicked</span>
          <span className="rec-step-value" style={{ color: data.customerClicked ? "#22c55e" : "#ef4444" }}>{data.customerClicked ? "✓" : "✗"}</span>
        </div>
        <div className="rec-arrow">↓</div>
        <div className="rec-step">
          <span className="rec-step-label">Purchased</span>
          <span className="rec-step-value" style={{ color: data.purchased ? "#22c55e" : "#6b7280" }}>{data.purchased ? "✓" : "—"}</span>
        </div>
      </div>
    </div>
  );
}
