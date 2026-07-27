"use client";

import type { MerchantHealth } from "@/lib/merchant/types";

interface MerchantHealthProps {
  data: MerchantHealth;
}

const arc = 282.74;

const components = [
  { key: "website", label: "Website" },
  { key: "ai", label: "AI" },
  { key: "knowledge", label: "Knowledge" },
  { key: "billing", label: "Billing" },
  { key: "conversations", label: "Conversations" },
  { key: "crawler", label: "Crawler" },
  { key: "usage", label: "Usage" },
] as const;

export function MerchantHealth({ data }: MerchantHealthProps) {
  const color = data.score >= 90 ? "#22c55e" : data.score >= 75 ? "#eab308" : data.score >= 60 ? "#f97316" : "#ef4444";
  const offset = arc - (arc * data.score) / 100;

  return (
    <div className="mcht-health">
      <div className="mcht-health-ring">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border)" strokeWidth="8" />
          <circle cx="50" cy="50" r="45" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={arc} strokeDashoffset={offset} transform="rotate(-90 50 50)" />
          <text x="50" y="48" textAnchor="middle" dominantBaseline="middle" fill="var(--text-primary)" fontSize="22" fontWeight="700">{data.score}%</text>
          <text x="50" y="65" textAnchor="middle" dominantBaseline="middle" fill="var(--ink-soft)" fontSize="8">{data.label}</text>
        </svg>
      </div>
      <div className="mcht-health-list">
        {components.map((c) => {
          const val = data[c.key as keyof MerchantHealth] as number;
          const barColor = val >= 90 ? "#22c55e" : val >= 75 ? "#eab308" : val >= 60 ? "#f97316" : "#ef4444";
          return (
            <div key={c.key} className="mcht-health-row">
              <span className="mcht-health-label">{c.label}</span>
              <div className="mcht-health-bar-track">
                <div className="mcht-health-bar-fill" style={{ width: `${val}%`, backgroundColor: barColor }} />
              </div>
              <span className="mcht-health-val">{val}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
