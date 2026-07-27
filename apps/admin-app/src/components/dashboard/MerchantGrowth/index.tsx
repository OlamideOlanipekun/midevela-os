"use client";

import type { MerchantGrowthData } from "@/lib/dashboard/types";
import { useMemo } from "react";

interface Props {
  data: MerchantGrowthData[];
  height?: number;
}

export function MerchantGrowth({ data, height = 160 }: Props) {
  const maxVal = useMemo(() => Math.max(...data.map((d) => d.newMerchants), 1), [data]);
  const w = 100 / data.length;

  return (
    <div className="stat-card">
      <h3 className="stat-title">Merchant Growth</h3>
      <div className="chart-wrap" style={{ height }}>
        <div className="chart-bars">
          {data.map((d) => (
            <div key={d.date} className="chart-bar-group" style={{ width: `${w}%` }}>
              <div className="chart-stack">
                <div className="chart-bar bar-merchants" style={{ height: `${(d.newMerchants / maxVal) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
