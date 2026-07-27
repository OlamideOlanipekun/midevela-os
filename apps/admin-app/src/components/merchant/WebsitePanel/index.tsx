"use client";

import type { MerchantDetail } from "@/lib/merchant/types";

interface WebsitePanelProps {
  websites: MerchantDetail["websites"];
}

const dot = (s: string) => {
  const c = s === "ACTIVE" || s === "READY" ? "dot-green" : s === "INACTIVE" || s === "CRAWLING" ? "dot-yellow" : "dot-red";
  return <span className={`status-dot ${c}`} />;
};

export function WebsitePanel({ websites }: WebsitePanelProps) {
  if (websites.length === 0) {
    return <p className="text-sm text-ink-soft">No websites registered.</p>;
  }

  return (
    <div className="ws-panel-list">
      {websites.map((w) => (
        <div key={w.id} className="ws-panel-card">
          <div className="ws-panel-row">
            <span className="ws-panel-label">Domain</span>
            <span className="ws-panel-value font-mono">{w.normalizedUrl}</span>
          </div>
          <div className="ws-panel-row">
            <span className="ws-panel-label">Status</span>
            <span className="ws-panel-value">{dot(w.status)} {w.status}</span>
          </div>
          <div className="ws-panel-row">
            <span className="ws-panel-label">Crawl</span>
            <span className="ws-panel-value">{dot(w.crawlStatus)} {w.crawlStatus.replace(/_/g, " ")}</span>
          </div>
          {w.lastCrawledAt && (
            <div className="ws-panel-row">
              <span className="ws-panel-label">Last Crawled</span>
              <span className="ws-panel-value">{new Date(w.lastCrawledAt).toLocaleDateString()}</span>
            </div>
          )}
          <div className="ws-panel-row">
            <span className="ws-panel-label">Created</span>
            <span className="ws-panel-value">{new Date(w.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
