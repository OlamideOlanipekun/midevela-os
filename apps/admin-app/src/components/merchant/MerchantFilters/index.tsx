"use client";

import { useState } from "react";

interface MerchantFiltersProps {
  search: string;
  status: string;
  plan: string;
  country: string;
  onSearch: (v: string) => void;
  onStatus: (v: string) => void;
  onPlan: (v: string) => void;
  onCountry: (v: string) => void;
  onExport?: () => void;
}

const statuses = ["", "active", "trialing", "past_due", "cancelled", "expired"];
const plans = ["", "starter", "growth", "enterprise"];
const countries = ["", "Nigeria", "Kenya", "Ghana", "South Africa"];

export function MerchantFilters({ search, status, plan, country, onSearch, onStatus, onPlan, onCountry, onExport }: MerchantFiltersProps) {
  return (
    <div className="flx-col gap-3 sm:flx-row sm:items-center sm:flex-wrap">
      <div className="srch-wrap flex-1 min-w-[200px]">
        <svg className="srch-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input
          className="srch-input"
          placeholder="Search by name, email, or domain..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <select className="fltr-select" value={status} onChange={(e) => onStatus(e.target.value)}>
        <option value="">All Status</option>
        {statuses.filter(Boolean).map((s) => (<option key={s} value={s}>{s.replace("_", " ")}</option>))}
      </select>
      <select className="fltr-select" value={plan} onChange={(e) => onPlan(e.target.value)}>
        <option value="">All Plans</option>
        {plans.filter(Boolean).map((p) => (<option key={p} value={p}>{p}</option>))}
      </select>
      <select className="fltr-select" value={country} onChange={(e) => onCountry(e.target.value)}>
        <option value="">All Countries</option>
        {countries.filter(Boolean).map((c) => (<option key={c} value={c}>{c}</option>))}
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
