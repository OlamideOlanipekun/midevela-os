"use client";

import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/api/request";
import { MerchantFilters } from "@/components/merchant/MerchantFilters";
import { MerchantTable } from "@/components/merchant/MerchantTable";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import type { MerchantListResponse } from "@/lib/merchant/types";

export default function MerchantsPage() {
  const [data, setData] = useState<MerchantListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [country, setCountry] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (plan) params.set("plan", plan);
    if (country) params.set("country", country);
    params.set("page", String(page));
    params.set("limit", String(limit));

    const res = await apiRequest<MerchantListResponse>(`/api/admin/merchants?${params}`);
    if (res.ok) {
      setData(res.data);
      setError(null);
    } else {
      setError("Failed to load merchants");
    }
    setLoading(false);
  }, [search, status, plan, country, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!data) return;
    if (selected.size === data.items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.items.map((m) => m.id)));
    }
  };

  const handleLoginAs = async (id: string) => {
    const res = await apiRequest<{ token: string; expiresIn: number }>(`/api/admin/merchants/${id}/login-as`, { method: "POST" });
    if (res.ok) {
      window.open(`/api/auth/impersonate?token=${res.data.token}`, "_blank");
    }
  };

  const handleSuspend = async (id: string) => {
    await apiRequest(`/api/admin/merchants/${id}/suspend`, { method: "PATCH" });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await apiRequest(`/api/admin/merchants/${id}/delete`, { method: "DELETE" });
    fetchData();
  };

  const handleBulkSuspend = async () => {
    for (const id of selected) {
      await apiRequest(`/api/admin/merchants/${id}/suspend`, { method: "PATCH" });
    }
    setSelected(new Set());
    fetchData();
  };

  const handleBulkDelete = async () => {
    for (const id of selected) {
      await apiRequest(`/api/admin/merchants/${id}/delete`, { method: "DELETE" });
    }
    setSelected(new Set());
    fetchData();
  };

  const handleExport = () => {
    if (!data) return;
    const csv = [
      ["Name", "Email", "Plan", "Status", "Conversations", "Created"].join(","),
      ...data.items.map((m) =>
        [m.name, m.ownerEmail || "", m.plan || "", m.status, m.conversations, m.createdAt].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "merchants.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flx-col gap-4">
      <div className="flx-row items-start justify-between">
        <div>
          <div className="dash-breadcrumb">Merchants</div>
          <h1 className="dash-title">Merchants</h1>
        </div>
        {selected.size > 0 && (
          <div className="flx-row gap-2">
            <span className="text-sm text-ink-soft">{selected.size} selected</span>
            <Button variant="ghost" size="sm" onClick={handleBulkSuspend}>Suspend</Button>
            <Button variant="danger" size="sm" onClick={handleBulkDelete}>Delete</Button>
            <Button variant="secondary" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}
      </div>

      <MerchantFilters
        search={search} status={status} plan={plan} country={country}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        onStatus={(v) => { setStatus(v); setPage(1); }}
        onPlan={(v) => { setPlan(v); setPage(1); }}
        onCountry={(v) => { setCountry(v); setPage(1); }}
        onExport={handleExport}
      />

      {loading ? (
        <div className="flx-center py-20"><Spinner size="lg" /></div>
      ) : error ? (
        <div className="dash-error"><p>{error}</p><Button variant="secondary" size="sm" onClick={fetchData}>Retry</Button></div>
      ) : !data ? null : (
        <>
          <MerchantTable
            items={data.items}
            selected={selected}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onLoginAs={handleLoginAs}
            onSuspend={handleSuspend}
            onDelete={handleDelete}
          />

          {data.totalPages > 1 && (
            <div className="flx-row items-center justify-between">
              <span className="text-sm text-ink-soft">{data.total} merchants total</span>
              <div className="flx-row gap-1">
                <button className="pag-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
                {Array.from({ length: Math.min(data.totalPages, 7) }, (_, i) => {
                  let p: number;
                  if (data.totalPages <= 7) {
                    p = i + 1;
                  } else if (page <= 4) {
                    p = i + 1;
                  } else if (page >= data.totalPages - 3) {
                    p = data.totalPages - 6 + i;
                  } else {
                    p = page - 3 + i;
                  }
                  return (
                    <button key={p} className={`pag-btn ${p === page ? "active" : ""}`} onClick={() => setPage(p)}>
                      {p}
                    </button>
                  );
                })}
                <button className="pag-btn" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Next →</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
