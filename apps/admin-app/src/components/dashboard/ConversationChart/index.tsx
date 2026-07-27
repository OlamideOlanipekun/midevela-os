"use client";

import type { ConversationTrendData } from "@/lib/dashboard/types";
import { useMemo } from "react";

interface Props {
  data: ConversationTrendData[];
  height?: number;
}

export function ConversationChart({ data, height = 180 }: Props) {
  const maxVal = useMemo(() => Math.max(...data.map((d) => d.messages), 1), [data]);
  const w = 100 / data.length;

  return (
    <div className="stat-card">
      <h3 className="stat-title">Conversations</h3>
      <div className="chart-wrap" style={{ height }}>
        <div className="chart-bars">
          {data.map((d) => (
            <div key={d.date} className="chart-bar-group" style={{ width: `${w}%` }}>
              <div className="chart-stack">
                <div className="chart-bar bar-resolved" style={{ height: `${(d.resolved / maxVal) * 100}%` }} />
                <div className="chart-bar bar-handovers" style={{ height: `${(d.handovers / maxVal) * 100}%` }} />
                <div className="chart-bar bar-msgs" style={{ height: `${(d.messages / maxVal) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="chart-legend">
        <span className="legend-item"><span className="legend-dot dot-msgs" /> Messages</span>
        <span className="legend-item"><span className="legend-dot dot-handovers" /> Handovers</span>
        <span className="legend-item"><span className="legend-dot dot-resolved" /> Resolved</span>
      </div>
    </div>
  );
}
