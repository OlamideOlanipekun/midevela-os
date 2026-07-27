"use client";

import type { KPIData } from "@/lib/dashboard/types";

interface Props {
  data: KPIData;
}

function fmtCurrency(n: number): string {
  return n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(1)}M` : `₦${(n / 1_000).toFixed(0)}K`;
}

const cards = [
  { label: "Revenue Today", key: "revenueToday", fmt: fmtCurrency, secondary: "revenueChange", suffix: "%" },
  { label: "Active Merchants", key: "activeMerchants", fmt: (n: number) => n.toLocaleString(), secondary: "newMerchantsToday", suffix: " new" },
  { label: "Live Visitors", key: "liveVisitors", fmt: (n: number) => n.toLocaleString() },
  { label: "Active Conversations", key: "activeConversations", fmt: (n: number) => n.toLocaleString() },
  { label: "AI Responses Today", key: "aiResponsesToday", fmt: (n: number) => n.toLocaleString() },
  { label: "Avg Response Time", key: "avgResponseTime", fmt: (n: number) => `${n.toFixed(1)}s` },
  { label: "Failed Requests", key: "failedRequests", fmt: (n: number) => `${n}`, secondary: "queueJobs", suffix: " queued" },
];

export function KPICards({ data }: Props) {
  return (
    <div className="kpi-grid">
      {cards.map((card) => {
        const val = data[card.key as keyof KPIData] as number;
        const sec = card.secondary ? (data[card.secondary as keyof KPIData] as number) : undefined;
        const changeCls = sec !== undefined && sec >= 0 ? "kpi-up" : "kpi-down";
        return (
          <div key={card.key} className="kpi-card">
            <span className="kpi-label">{card.label}</span>
            <span className="kpi-value">{card.fmt ? card.fmt(val) : val}</span>
            {sec !== undefined && (
              <div className="kpi-trend">
                <span className={changeCls}>
                  {sec > 0 ? "+" : ""}{sec}{card.suffix || ""}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
