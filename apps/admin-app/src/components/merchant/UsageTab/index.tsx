"use client";

import type { MerchantUsage } from "@/lib/merchant/types";

interface UsageTabProps {
  data: MerchantUsage | null;
}

interface UsageBarProps {
  label: string;
  used: number;
  limit: number;
  format?: (n: number) => string;
}

function pct(used: number, limit: number): number {
  if (limit === 0) return 0;
  return Math.round((used / limit) * 100);
}

function UsageBar({ label, used, limit, format }: UsageBarProps) {
  const percent = Math.min(pct(used, limit), 100);
  const fmt = format ?? ((n: number) => n.toLocaleString());
  const color = percent >= 90 ? "#ef4444" : percent >= 75 ? "#eab308" : "#22c55e";

  return (
    <div className="usage-bar">
      <div className="usage-bar-hdr">
        <span className="usage-bar-label">{label}</span>
        <span className="usage-bar-nums">{fmt(used)} / {fmt(limit)}</span>
      </div>
      <div className="usage-bar-track">
        <div className="usage-bar-fill" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
      <span className="usage-bar-pct">{percent}%</span>
    </div>
  );
}

export function UsageTab({ data }: UsageTabProps) {
  if (!data) {
    return <p className="text-sm text-ink-soft">No usage data available yet.</p>;
  }

  return (
    <div className="usage-grid">
      <UsageBar label="Messages" used={data.messages.used} limit={data.messages.limit} />
      <UsageBar label="Products" used={data.products.used} limit={data.products.limit} />
      <UsageBar label="Knowledge Files" used={data.knowledgeFiles.used} limit={data.knowledgeFiles.limit} />
      <UsageBar label="Storage" used={data.storage.bytes} limit={data.storage.limitBytes} format={(n) => n === data.storage.bytes ? data.storage.formatted : data.storage.limitFormatted} />
      <UsageBar label="API Calls" used={data.apiCalls.thisMonth} limit={data.apiCalls.limit} />
      <UsageBar label="Embeddings" used={data.embeddings.total} limit={data.embeddings.limit} />
      <UsageBar label="Crawler Minutes" used={data.crawlerMinutes.used} limit={data.crawlerMinutes.limit} />
    </div>
  );
}
