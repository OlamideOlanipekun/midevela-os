"use client";

import type { ActivityItem } from "@/lib/dashboard/types";

interface Props {
  data: ActivityItem[];
}

const icons: Record<string, string> = {
  onboard: "🚀",
  payment: "💰",
  crawl: "🕸️",
  upgrade: "⬆️",
  knowledge: "🧠",
  escalation: "🔔",
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

export function RecentActivity({ data }: Props) {
  return (
    <div className="stat-card">
      <h3 className="stat-title">Recent Activity</h3>
      <div className="activity-list">
        {data.slice(0, 12).map((a) => (
          <div key={a.id} className="activity-row">
            <span className="activity-icon">{icons[a.type] || "📋"}</span>
            <div className="activity-body">
              <span className="activity-title">{a.title}</span>
              <span className="activity-time">{fmtTime(a.time)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
