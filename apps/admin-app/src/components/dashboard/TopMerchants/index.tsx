"use client";

import type { TopMerchant } from "@/lib/dashboard/types";

interface Props {
  data: TopMerchant[];
}

function fmtCurrency(n: number): string {
  return n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(1)}M` : `₦${(n / 1_000).toFixed(0)}K`;
}

export function TopMerchants({ data }: Props) {
  return (
    <div className="stat-card">
      <h3 className="stat-title">Top Merchants</h3>
      <div className="merchant-list">
        {data.map((m, i) => (
          <div key={m.id} className="merchant-row">
            <span className="merchant-rank">{i + 1}</span>
            <div className="merchant-info">
              <span className="merchant-name">{m.name}</span>
              <div className="merchant-stats">
                <span className="merchant-stat">{fmtCurrency(m.revenue)}</span>
                <span className="merchant-stat">{m.conversations} convs</span>
                <span className="merchant-stat">{m.conversion}% conv</span>
                <span className="merchant-stat">AI {m.aiScore}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
