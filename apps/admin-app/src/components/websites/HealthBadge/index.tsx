"use client";

export function HealthBadge({ score }: { score: number }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : score >= 40 ? "#f97316" : "#ef4444";
  const label = score >= 80 ? "Healthy" : score >= 60 ? "Fair" : score >= 40 ? "Poor" : "Critical";

  return (
    <div className="flx-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="var(--border)" strokeWidth="5" />
          <circle cx="32" cy="32" r="28" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={175.93} strokeDashoffset={175.93 - (175.93 * score) / 100}
            transform="rotate(-90 32 32)" />
          <text x="32" y="36" textAnchor="middle" dominantBaseline="middle" fill="var(--ink)" fontSize="14" fontWeight="700">{score}%</text>
        </svg>
      </div>
      <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color }}>{label}</span>
    </div>
  );
}
