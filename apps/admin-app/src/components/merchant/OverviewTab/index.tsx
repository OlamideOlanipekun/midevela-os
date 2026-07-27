"use client";

import type { MerchantDetail, MerchantAnalytics } from "@/lib/merchant/types";
import { MerchantStats } from "@/components/merchant/MerchantStats";
import { MerchantHealth } from "@/components/merchant/MerchantHealth";

interface OverviewTabProps {
  detail: MerchantDetail;
  analytics: MerchantAnalytics | null;
}

export function OverviewTab({ detail, analytics }: OverviewTabProps) {
  const revenue = analytics?.revenue?.total ?? 0;
  const convRate = analytics?.conversions?.rate ?? 0;
  const msgTrend = analytics?.messages?.trend ?? [];

  const stats = [
    { label: "Revenue", value: revenue >= 1_000_000 ? `₦${(revenue / 1_000_000).toFixed(1)}M` : `₦${(revenue / 1_000).toFixed(0)}K` },
    { label: "Conversations", value: detail.conversations.toLocaleString() },
    { label: "Products", value: detail.products.toLocaleString() },
    { label: "Documents", value: detail.knowledgeEntries.toLocaleString() },
    { label: "AI Score", value: `${detail.health.ai}%` },
    { label: "Health", value: `${detail.health.score}%` },
    { label: "Messages", value: detail.messages.toLocaleString() },
    { label: "Conversion Rate", value: `${convRate}%` },
  ];

  const maxMsg = Math.max(...msgTrend, 1);

  return (
    <div>
      <MerchantStats stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <div className="stat-card">
          <h3 className="stat-title">Conversation Trend</h3>
          <div className="chart-wrap" style={{ height: 140 }}>
            <div className="chart-bars">
              {msgTrend.map((v, i) => (
                <div key={i} className="chart-bar-group" style={{ width: `${100 / msgTrend.length}%` }}>
                  <div className="chart-stack">
                    <div className="chart-bar bar-msgs" style={{ height: `${(v / maxMsg) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-ink-soft font-mono mt-1">
            <span>-6d</span><span>Today</span>
          </div>
        </div>

        <MerchantHealth data={detail.health} />
      </div>
    </div>
  );
}
