"use client";

interface ConversationFiltersProps {
  search: string; status: string; escalated: string;
  onSearch: (v: string) => void;
  onStatus: (v: string) => void;
  onEscalated: (v: string) => void;
}

export function ConversationFilters({ search, status, escalated, onSearch, onStatus, onEscalated }: ConversationFiltersProps) {
  return (
    <div className="flx-col gap-3 sm:flx-row sm:items-center sm:flex-wrap">
      <div className="srch-wrap flex-1 min-w-[200px]">
        <svg className="srch-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input className="srch-input" placeholder="Search customer, merchant, or ID..." value={search} onChange={(e) => onSearch(e.target.value)} />
      </div>
      <select className="fltr-select" value={status} onChange={(e) => onStatus(e.target.value)}>
        <option value="">All Status</option>
        <option value="ACTIVE">Active</option>
        <option value="ENDED">Ended</option>
        <option value="HANDED_OFF">Handed Off</option>
      </select>
      <select className="fltr-select" value={escalated} onChange={(e) => onEscalated(e.target.value)}>
        <option value="">All Conversations</option>
        <option value="true">Escalated</option>
      </select>
    </div>
  );
}
