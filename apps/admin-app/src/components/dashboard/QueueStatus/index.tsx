"use client";

import type { QueueData } from "@/lib/dashboard/types";

interface Props {
  data: QueueData[];
}

const dot = (s: string) => {
  const c = s === "running" || s === "healthy" ? "dot-green" : s === "pending" ? "dot-yellow" : "dot-red";
  return <span className={`status-dot ${c}`} />;
};

export function QueueStatus({ data }: Props) {
  return (
    <div className="stat-card">
      <h3 className="stat-title">Queue Status</h3>
      <div className="queue-list">
        {data.map((q) => (
          <div key={q.name} className="queue-row">
            <span className="queue-name">
              {dot(q.status)}
              {q.name}
            </span>
            <span className={`queue-badge badge-${q.status}`}>
              {q.status}{q.count !== undefined ? ` (${q.count})` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
