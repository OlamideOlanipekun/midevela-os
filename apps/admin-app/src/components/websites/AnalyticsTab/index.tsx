"use client";

import type { WebsiteAnalyticsData } from "@/lib/websites/types";

interface AnalyticsTabProps {
  data: WebsiteAnalyticsData | null;
}

export function AnalyticsTab({ data }: AnalyticsTabProps) {
  return (
    <div className="stat-card">
      <h3 className="stat-title">Website Analytics</h3>
      <p className="text-sm text-ink-soft mt-2">Analytics data will populate as crawl and health data accumulates.</p>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="p-3 border border-border rounded-lg">
          <span className="text-xs text-ink-soft">Products Growth</span>
          <p className="text-lg font-bold mt-1">{data?.productsGrowth?.length ?? 0} data points</p>
        </div>
        <div className="p-3 border border-border rounded-lg">
          <span className="text-xs text-ink-soft">Pages Indexed</span>
          <p className="text-lg font-bold mt-1">{data?.pagesIndexed?.length ?? 0} data points</p>
        </div>
      </div>
    </div>
  );
}
