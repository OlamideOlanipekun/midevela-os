"use client";

interface WebsiteFiltersProps {
  search: string; status: string; crawler: string; merchant: string;
  onSearch: (v: string) => void;
  onStatus: (v: string) => void;
  onCrawler: (v: string) => void;
  onMerchant: (v: string) => void;
  onExport?: () => void;
}

const statuses = ["", "ACTIVE", "INACTIVE", "SUSPENDED", "DELETED"];
const crawlers = ["", "READY", "CRAWLING", "INDEXING", "NOT_STARTED", "FAILED"];

export function WebsiteFilters({ search, status, crawler, merchant, onSearch, onStatus, onCrawler, onMerchant, onExport }: WebsiteFiltersProps) {
  return (
    <div className="flx-col gap-3 sm:flx-row sm:items-center sm:flex-wrap">
      <div className="srch-wrap flex-1 min-w-[200px]">
        <svg className="srch-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input className="srch-input" placeholder="Search website, merchant, or domain..." value={search} onChange={(e) => onSearch(e.target.value)} />
      </div>
      <select className="fltr-select" value={status} onChange={(e) => onStatus(e.target.value)}>
        <option value="">All Status</option>
        {statuses.filter(Boolean).map((s) => (<option key={s} value={s}>{s}</option>))}
      </select>
      <select className="fltr-select" value={crawler} onChange={(e) => onCrawler(e.target.value)}>
        <option value="">All Crawlers</option>
        {crawlers.filter(Boolean).map((c) => (<option key={c} value={c}>{c.replace("_", " ")}</option>))}
      </select>
      {onExport && (
        <button className="btn-ghost btn-sm" onClick={onExport}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          Export
        </button>
      )}
    </div>
  );
}
