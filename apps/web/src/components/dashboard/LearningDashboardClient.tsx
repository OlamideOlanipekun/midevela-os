"use client";

import React, { useState } from "react";
import { LearningDashboardOverview } from "@/server/learning/types";

interface Props {
  initialData: LearningDashboardOverview;
}

export function LearningDashboardClient({ initialData }: Props) {
  const [data, setData] = useState<LearningDashboardOverview>(initialData);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const handlePromoteModel = async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/dashboard/learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "promote_model", version: "v2.2.0-candidate" }),
      });
      const result = await res.json();
      if (res.ok) {
        setActionMessage("Model v2.2.0-candidate promoted to PRODUCTION successfully!");
      } else {
        setActionMessage(`Promotion error: ${result.error || "Threshold check failed"}`);
      }
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/dashboard/learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rollback_model" }),
      });
      const result = await res.json();
      if (res.ok) {
        setActionMessage("Rolled back to previous production model version.");
      } else {
        setActionMessage(`Rollback error: ${result.error}`);
      }
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "24px", color: "#f8fafc", fontFamily: "sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700", margin: 0, color: "#ffffff" }}>
            Midevela Learning Engine
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "14px", marginTop: "4px" }}>
            Adaptive commerce intelligence continuously optimizing intent matching & conversion ranking
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              padding: "6px 14px",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: "600",
              background: "rgba(16, 185, 129, 0.15)",
              color: "#34d399",
              border: "1px solid rgba(52, 211, 153, 0.3)",
            }}
          >
            ● Active Model: {data.activeModelVersion}
          </span>
        </div>
      </div>

      {actionMessage && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "24px",
            background: "rgba(59, 130, 246, 0.15)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            color: "#60a5fa",
            fontSize: "14px",
          }}
        >
          {actionMessage}
        </div>
      )}

      {/* Primary Metrics Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginBottom: "32px" }}>
        {/* Metric 1 */}
        <div
          style={{
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            padding: "20px",
            borderRadius: "14px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div style={{ fontSize: "13px", color: "#94a3b8", fontWeight: "500" }}>AI Influenced Revenue</div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#ffffff", marginTop: "8px" }}>
            ₦{(data.aiInfluencedRevenue / 1000000).toFixed(1)}M
          </div>
          <div style={{ fontSize: "12px", color: "#34d399", marginTop: "6px", fontWeight: "600" }}>
            ↑ Attributed from Midevela concierge
          </div>
        </div>

        {/* Metric 2 */}
        <div
          style={{
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            padding: "20px",
            borderRadius: "14px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div style={{ fontSize: "13px", color: "#94a3b8", fontWeight: "500" }}>Conversion Improvement</div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#34d399", marginTop: "8px" }}>
            +{data.conversionRateImprovementPct}%
          </div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "6px" }}>vs baseline standard ranking</div>
        </div>

        {/* Metric 3 */}
        <div
          style={{
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            padding: "20px",
            borderRadius: "14px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div style={{ fontSize: "13px", color: "#94a3b8", fontWeight: "500" }}>Recommendation CTR</div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#60a5fa", marginTop: "8px" }}>
            {data.recommendationCtrPct}%
          </div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "6px" }}>Product recommendations clicked</div>
        </div>

        {/* Metric 4 */}
        <div
          style={{
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            padding: "20px",
            borderRadius: "14px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div style={{ fontSize: "13px", color: "#94a3b8", fontWeight: "500" }}>Add-To-Cart Rate</div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#a78bfa", marginTop: "8px" }}>
            {data.addToCartRatePct}%
          </div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "6px" }}>From AI recommendations</div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Top Intents Card */}
        <div
          style={{
            background: "#1e293b",
            borderRadius: "14px",
            padding: "24px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <h3 style={{ fontSize: "18px", fontWeight: "700", margin: "0 0 16px 0", color: "#ffffff" }}>
            Top Performing Intents
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {data.topIntents.map((intent, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                }}
              >
                <div>
                  <div style={{ fontWeight: "600", color: "#e2e8f0", fontSize: "14px" }}>"{intent.intentKey}"</div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                    {intent.impressions} recommendations · {intent.purchases} purchases
                  </div>
                </div>
                <div style={{ fontWeight: "700", color: "#34d399", fontSize: "15px" }}>
                  {intent.conversionRatePct}% conv
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Learning Insights */}
        <div
          style={{
            background: "#1e293b",
            borderRadius: "14px",
            padding: "24px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <h3 style={{ fontSize: "18px", fontWeight: "700", margin: "0 0 16px 0", color: "#ffffff" }}>
            Automated Learning Signals
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {data.learningInsights.map((insight) => (
              <div
                key={insight.id}
                style={{
                  padding: "14px 16px",
                  borderRadius: "8px",
                  background: "rgba(15, 23, 42, 0.6)",
                  borderLeft: insight.positive ? "4px solid #34d399" : "4px solid #f87171",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: "700", color: "#f8fafc", fontSize: "14px" }}>{insight.title}</span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "700",
                      color: insight.positive ? "#34d399" : "#f87171",
                    }}
                  >
                    {insight.impact}
                  </span>
                </div>
                <p style={{ fontSize: "13px", color: "#94a3b8", margin: "6px 0 0 0" }}>{insight.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Model Governance Controls */}
      <div
        style={{
          marginTop: "32px",
          background: "#1e293b",
          borderRadius: "14px",
          padding: "24px",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#ffffff" }}>
            Model Governance & Safety
          </h4>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#94a3b8" }}>
            Manage ranking model deployment versions with offline evaluation and instant rollbacks.
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={handlePromoteModel}
            disabled={loading}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              background: "#2563eb",
              color: "#ffffff",
              fontWeight: "600",
              border: "none",
              cursor: "pointer",
            }}
          >
            Promote Candidate Model
          </button>
          <button
            onClick={handleRollback}
            disabled={loading}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              background: "rgba(239, 68, 68, 0.2)",
              color: "#f87171",
              fontWeight: "600",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              cursor: "pointer",
            }}
          >
            Rollback to Previous
          </button>
        </div>
      </div>
    </div>
  );
}
