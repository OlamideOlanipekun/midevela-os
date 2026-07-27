"use client";

import type { InfrastructureData } from "@/lib/dashboard/types";

interface Props {
  data: InfrastructureData[];
}

const dot = (s: string) => {
  const c = s === "up" ? "dot-green" : s === "degraded" ? "dot-yellow" : "dot-red";
  return <span className={`status-dot ${c}`} />;
};

const label = (s: string) => s === "up" ? "Operational" : s === "degraded" ? "Degraded" : "Down";

export function Infrastructure({ data }: Props) {
  return (
    <div className="stat-card">
      <h3 className="stat-title">Infrastructure</h3>
      <div className="infra-list">
        {data.map((svc) => (
          <div key={svc.name} className="infra-row">
            <span className="infra-name">
              {dot(svc.status)}
              {svc.name}
            </span>
            <span className={`infra-status status-${svc.status}`}>{label(svc.status)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
