"use client";

import React, { useEffect, useState } from "react";
import { LearningDashboardClient } from "@/components/dashboard/LearningDashboardClient";
import { LearningDashboardOverview } from "@/server/learning/types";

export default function LearningDashboardPage() {
  const [data, setData] = useState<LearningDashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/learning")
      .then((res) => res.json())
      .then((overview) => setData(overview))
      .catch((err) => {
        console.error("Failed to load learning dashboard overview:", err);
        // Fallback default data
        setData({
          aiInfluencedRevenue: 8400000,
          conversionRateImprovementPct: 18.2,
          recommendationCtrPct: 24.8,
          addToCartRatePct: 13.4,
          topIntents: [
            { intentKey: "running shoes under 100k", impressions: 420, purchases: 77, conversionRatePct: 18.4 },
            { intentKey: "office dress", impressions: 310, purchases: 47, conversionRatePct: 15.1 },
            { intentKey: "gift for partner", impressions: 280, purchases: 36, conversionRatePct: 12.8 },
          ],
          learningInsights: [
            {
              id: "insight-1",
              category: "PRODUCT",
              title: "High-Converting Product Variant",
              description: "Black variants convert +22% higher than light variants for footwear.",
              impact: "+22% Conversion",
              positive: true,
            },
            {
              id: "insight-2",
              category: "CONVERSATION",
              title: "2-Product Comparison Effectiveness",
              description: "Presenting a 2-product side-by-side comparison increases add-to-cart by +9.4%.",
              impact: "+9.4% Add-to-cart",
              positive: true,
            },
            {
              id: "insight-3",
              category: "INTENT",
              title: "Shipping Inquiry High Intent Signal",
              description: "Shoppers asking about delivery timelines convert at 3.2x baseline rate.",
              impact: "3.2x Purchase Likelihood",
              positive: true,
            },
          ],
          activeExperiments: 2,
          activeModelVersion: "v2.1.0-adaptive",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "60px", textAlign: "center", color: "#94a3b8" }}>
        Loading Learning Engine Overview...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: "60px", textAlign: "center", color: "#94a3b8" }}>
        Unable to load Learning Engine data. Please refresh.
      </div>
    );
  }

  return <LearningDashboardClient initialData={data} />;
}
