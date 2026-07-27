"use client";

import type { CrawlJobItem } from "@/lib/websites/types";

interface CrawlHistoryProps {
  items: CrawlJobItem[];
}

function groupByDate(items: CrawlJobItem[]): [string, CrawlJobItem[]][] {
  const groups = new Map<string, CrawlJobItem[]>();
  for (const item of items) {
    const d = new Date(item.createdAt).toLocaleDateString();
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(item);
  }
  return Array.from(groups.entries());
}

const statusBadge = (s: string) => {
  const c = s === "COMPLETED" ? "badge-running" : s === "RUNNING" || s === "PENDING" ? "badge-pending" : s === "FAILED" ? "badge-failed" : "";
  return <span className={`queue-badge ${c}`}>{s}</span>;
};

export function CrawlHistory({ items }: CrawlHistoryProps) {
  const groups = groupByDate(items);

  if (groups.length === 0) return <p className="text-sm text-ink-soft">No crawl history.</p>;

  return (
    <div className="tm-line">
      {groups.map(([date, activities]) => (
        <div key={date} className="tm-group">
          <div className="tm-date">{date}</div>
          {activities.map((j) => (
            <div key={j.id} className="tm-item">
              <div className="tm-dot" />
              <div className="tm-body">
                <div className="flx-row gap-2">
                  <span className="tm-action">Crawl {j.status.toLowerCase()}</span>
                  {statusBadge(j.status)}
                </div>
                <div className="flx-row gap-3 text-xs text-ink-soft">
                  <span>{j.pagesFound} pages</span>
                  <span>{j.productsFound} products</span>
                  {j.errors > 0 && <span className="text-rust">{j.errors} errors</span>}
                  <span>{j.duration}s</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
