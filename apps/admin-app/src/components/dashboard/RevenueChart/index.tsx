"use client";

import type { RevenueData } from "@/lib/dashboard/types";
import { useMemo } from "react";

interface Props {
  data: RevenueData[];
  height?: number;
}

export function RevenueChart({ data, height = 200 }: Props) {
  const maxVal = useMemo(() => Math.max(...data.map((d) => d.revenue), 1), [data]);
  const w = 100 / data.length;

  return (
    <div className="stat-card">
      <h3 className="stat-title">Revenue</h3>
      <div className="chart-wrap" style={{ height }}>
        <div className="chart-bars">
          {data.map((d) => (
            <div key={d.date} className="chart-bar-group" style={{ width: `${w}%` }}>
              <div className="chart-stack">
                <div
                  className="chart-bar bar-upgrades"
                  style={{ height: `${(d.upgrades / maxVal) * 100}%` }}
                />
                <div
                  className="chart-bar bar-subs"
                  style={{ height: `${(d.subscriptions / maxVal) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="chart-legend">
        <span className="legend-item"><span className="legend-dot dot-subs" /> Subscriptions</span>
        <span className="legend-item"><span className="legend-dot dot-upgrades" /> Upgrades</span>
      </div>
    </div>
  );
}
