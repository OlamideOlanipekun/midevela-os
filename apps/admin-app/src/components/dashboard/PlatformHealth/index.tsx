"use client";

import type { HealthScore } from "@/lib/dashboard/types";

interface Props {
  data: HealthScore;
}

const statusDot = (s: string) => {
  const c = s === "healthy" ? "dot-green" : s === "degraded" ? "dot-yellow" : "dot-red";
  return <span className={`status-dot ${c}`} />;
};

export function PlatformHealth({ data }: Props) {
  const arc = 282.74;
  const offset = arc - (arc * data.score) / 100;
  const color =
    data.score >= 95 ? "#22c55e" : data.score >= 85 ? "#eab308" : data.score >= 70 ? "#f97316" : "#ef4444";

  return (
    <div className="stat-card">
      <h3 className="stat-title">Platform Health</h3>
      <div className="health-ring-wrap">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="45"
            fill="none" stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={arc}
            strokeDashoffset={offset}
            transform="rotate(-90 50 50)"
          />
          <text x="50" y="52" textAnchor="middle" dominantBaseline="middle"
            fill="var(--text-primary)" fontSize="22" fontWeight="700">
            {data.score}%
          </text>
        </svg>
      </div>
      <p className="health-label">{data.label}</p>
      <div className="health-list">
        {data.components.map((c) => (
          <div key={c.name} className="health-row">
            <span className="health-name">
              {statusDot(c.status)}
              {c.name}
            </span>
            <span className="health-val">{c.score}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
