"use client";

import type { MerchantActivityItem } from "@/lib/merchant/types";

interface MerchantTimelineProps {
  items: MerchantActivityItem[];
}

function groupByDate(items: MerchantActivityItem[]): [string, MerchantActivityItem[]][] {
  const groups = new Map<string, MerchantActivityItem[]>();
  for (const item of items) {
    const d = new Date(item.time).toLocaleDateString();
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(item);
  }
  return Array.from(groups.entries());
}

function fmtAction(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleTimeString();
}

export function MerchantTimeline({ items }: MerchantTimelineProps) {
  const groups = groupByDate(items);

  if (groups.length === 0) {
    return <p className="text-sm text-ink-soft">No activity recorded yet.</p>;
  }

  return (
    <div className="tm-line">
      {groups.map(([date, activities]) => (
        <div key={date} className="tm-group">
          <div className="tm-date">{date}</div>
          <div className="tm-items">
            {activities.map((a) => (
              <div key={a.id} className="tm-item">
                <div className="tm-dot" />
                <div className="tm-body">
                  <span className="tm-action">{fmtAction(a.action)}</span>
                  {a.adminName && <span className="tm-admin">by {a.adminName}</span>}
                  <span className="tm-time">{fmtTime(a.time)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
