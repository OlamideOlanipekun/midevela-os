"use client";

import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/api/request";
import { ConversationFilters } from "@/components/conversations/ConversationFilters";
import { ConversationTable } from "@/components/conversations/ConversationTable";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";

export default function ConversationsPage() {
  const [data, setData] = useState<{ items: any[]; total: number; page: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [escalated, setEscalated] = useState("");
  const [page, setPage] = useState(1);
  const [liveCount, setLiveCount] = useState(0);

  const limit = 25;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (escalated) params.set("escalated", escalated);
    params.set("page", String(page));
    params.set("limit", String(limit));

    const res = await apiRequest<any>(`/api/admin/conversations?${params}`);
    if (res.ok) {
      setData(res.data);
      setError(null);
    } else {
      setError("Failed to load conversations");
    }
    setLoading(false);
  }, [search, status, escalated, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const es = new EventSource("/api/admin/conversations/stream");
    es.onmessage = (e) => {
      try { const d = JSON.parse(e.data); if (d.type === "connected") setLiveCount(0); } catch {}
    };
    return () => es.close();
  }, []);

  return (
    <div className="flx-col gap-4">
      <div className="flx-row items-start justify-between">
        <div>
          <div className="dash-breadcrumb">Live Conversations</div>
          <h1 className="dash-title">Conversations</h1>
        </div>
        <div className="flx-row gap-2">
          <div className="flx-center gap-1 text-sm text-ink-soft">
            <span className="live-dot-small" />
            {liveCount} live
          </div>
          <Button variant="secondary" size="sm" onClick={fetchData}>Refresh</Button>
        </div>
      </div>

      <ConversationFilters
        search={search} status={status} escalated={escalated}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        onStatus={(v) => { setStatus(v); setPage(1); }}
        onEscalated={(v) => { setEscalated(v); setPage(1); }}
      />

      {loading ? (
        <div className="flx-center py-20"><Spinner size="lg" /></div>
      ) : error ? (
        <div className="dash-error"><p>{error}</p><Button variant="secondary" size="sm" onClick={fetchData}>Retry</Button></div>
      ) : !data ? null : (
        <>
          <ConversationTable items={data.items} />

          {data.totalPages > 1 && (
            <div className="flx-row items-center justify-between">
              <span className="text-sm text-ink-soft">{data.total} conversations total</span>
              <div className="flx-row gap-1">
                <button className="pag-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
                {Array.from({ length: Math.min(data.totalPages, 7) }, (_, i) => {
                  let p: number;
                  if (data.totalPages <= 7) p = i + 1;
                  else if (page <= 4) p = i + 1;
                  else if (page >= data.totalPages - 3) p = data.totalPages - 6 + i;
                  else p = page - 3 + i;
                  return <button key={p} className={`pag-btn ${p === page ? "active" : ""}`} onClick={() => setPage(p)}>{p}</button>;
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
