"use client";

interface StatItem {
  label: string;
  value: string | number;
}

interface MerchantStatsProps {
  stats: StatItem[];
}

export function MerchantStats({ stats }: MerchantStatsProps) {
  return (
    <div className="mcht-stats-grid">
      {stats.map((s) => (
        <div key={s.label} className="mcht-stat-card">
          <span className="mcht-stat-label">{s.label}</span>
          <span className="mcht-stat-value">{s.value}</span>
        </div>
      ))}
    </div>
  );
}
