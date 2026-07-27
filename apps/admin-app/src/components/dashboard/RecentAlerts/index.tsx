"use client";

import type { AlertItem } from "@/lib/dashboard/types";

interface Props {
  data: AlertItem[];
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

const alertColors: Record<string, string> = {
  critical: "#ef4444",
  warning: "#eab308",
  success: "#22c55e",
  info: "#3b82f6",
};

export function RecentAlerts({ data }: Props) {
  return (
    <div className="stat-card">
      <h3 className="stat-title">Alerts</h3>
      <div className="alert-list">
        {data.map((a) => (
          <div key={a.id} className="alert-row">
            <span
              className="alert-dot"
              style={{ backgroundColor: alertColors[a.type] || "#6b7280" }}
            />
            <div className="alert-body">
              <span className="alert-title">{a.title}</span>
              <span className="alert-time">{fmtTime(a.time)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
