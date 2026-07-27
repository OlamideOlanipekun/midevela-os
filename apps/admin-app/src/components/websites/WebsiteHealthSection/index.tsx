"use client";

import type { WebsiteHealthData } from "@/lib/websites/types";

interface WebsiteHealthSectionProps {
  data: WebsiteHealthData | null;
}

export function WebsiteHealthSection({ data }: WebsiteHealthSectionProps) {
  if (!data) {
    return <p className="text-sm text-ink-soft">No health data available yet. Health checks run periodically.</p>;
  }

  const metrics = [
    { label: "SSL", value: data.ssl, color: data.ssl >= 80 ? "#22c55e" : data.ssl >= 50 ? "#eab308" : "#ef4444" },
    { label: "Uptime", value: data.uptime, color: data.uptime >= 95 ? "#22c55e" : data.uptime >= 85 ? "#eab308" : "#ef4444" },
    { label: "Robots", value: data.robots, color: data.robots >= 80 ? "#22c55e" : data.robots >= 50 ? "#eab308" : "#ef4444" },
    { label: "Response Time", value: Math.max(0, 100 - Math.round(data.responseTime / 10)), color: data.responseTime < 300 ? "#22c55e" : data.responseTime < 1000 ? "#eab308" : "#ef4444", display: `${data.responseTime}ms` },
    { label: "Pages", value: Math.min(data.pages, 100), color: "#3b82f6", display: String(data.pages) },
    { label: "Products", value: Math.min(data.products, 100), color: "#8b5cf6", display: String(data.products) },
    { label: "Knowledge", value: Math.min(data.knowledge, 100), color: "#06b6d4", display: String(data.knowledge) },
  ];

  return (
    <div className="mcht-health">
      <div className="mcht-health-list flex-1">
        {metrics.map((m) => (
          <div key={m.label} className="mcht-health-row">
            <span className="mcht-health-label">{m.label}</span>
            <div className="mcht-health-bar-track">
              <div className="mcht-health-bar-fill" style={{ width: `${Math.min(m.value, 100)}%`, backgroundColor: m.color }} />
            </div>
            <span className="mcht-health-val">{m.display || `${m.value}%`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
