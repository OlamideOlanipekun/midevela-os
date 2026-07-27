"use client";

import type { CrawlJobItem } from "@/lib/websites/types";

interface CrawlMonitorProps {
  jobs: CrawlJobItem[];
}

export function CrawlMonitor({ jobs }: CrawlMonitorProps) {
  const running = jobs.find((j) => j.status === "RUNNING" || j.status === "PENDING");

  if (!running) return null;

  const total = Math.max(running.pagesFound + running.productsFound + running.categoriesFound, 1);
  const progress = Math.min(Math.round((total / 100) * 100), 99);

  return (
    <div className="stat-card">
      <h3 className="stat-title">Current Crawl</h3>
      <div className="mt-2 space-y-2">
        <div className="crawl-progress-bar">
          <div className="crawl-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-sm font-mono">{progress}%</span>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-ink-soft">Pages: {running.pagesFound}</span>
          <span className="text-ink-soft">Products: {running.productsFound}</span>
          <span className="text-ink-soft">Categories: {running.categoriesFound}</span>
          <span className="text-ink-soft">Errors: {running.errors}</span>
        </div>
        <p className="text-xs text-ink-soft">Started {running.startedAt ? new Date(running.startedAt).toLocaleTimeString() : "..."}</p>
      </div>
    </div>
  );
}
