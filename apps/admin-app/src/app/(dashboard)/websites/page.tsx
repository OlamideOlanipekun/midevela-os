"use client";

import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/api/request";
import { WebsiteFilters } from "@/components/websites/WebsiteFilters";
import { WebsiteTable } from "@/components/websites/WebsiteTable";
import { DuplicateWarning } from "@/components/websites/DuplicateWarning";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import type { WebsiteListResponse } from "@/lib/websites/types";

export default function WebsitesPage() {
  const [data, setData] = useState<WebsiteListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [crawler, setCrawler] = useState("");
  const [merchant, setMerchant] = useState("");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newOrgId, setNewOrgId] = useState("");
  const [adding, setAdding] = useState(false);
  const [dupWarning, setDupWarning] = useState<{ open: boolean; domain: string; owner?: string; status?: string }>({ open: false, domain: "" });

  const limit = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (crawler) params.set("crawler", crawler);
    if (merchant) params.set("merchant", merchant);
    params.set("page", String(page));
    params.set("limit", String(limit));

    const res = await apiRequest<WebsiteListResponse>(`/api/admin/websites?${params}`);
    if (res.ok) {
      setData(res.data);
      setError(null);
    } else {
      setError("Failed to load websites");
    }
    setLoading(false);
  }, [search, status, crawler, merchant, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async () => {
    if (!newUrl.trim() || !newOrgId.trim()) return;
    setAdding(true);
    const res = await apiRequest(`/api/admin/websites`, {
      method: "POST",
      body: JSON.stringify({ url: newUrl.trim(), orgId: newOrgId.trim() }),
    });
    if (res.ok) {
      setShowAdd(false);
      setNewUrl("");
      setNewOrgId("");
      fetchData();
    } else {
      const msg = (res.data as any)?.error || "";
      if (msg.includes("already registered")) {
        setDupWarning({ open: true, domain: newUrl.trim(), owner: "", status: "ACTIVE" });
      }
    }
    setAdding(false);
  };

  const handleSuspend = async (id: string) => {
    await apiRequest(`/api/admin/websites/${id}/suspend`, { method: "PATCH" });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await apiRequest(`/api/admin/websites/${id}/delete`, { method: "DELETE" });
    fetchData();
  };

  const handleExport = () => {
    if (!data) return;
    const csv = [
      ["Domain", "Merchant", "Health", "Crawler", "Products", "SSL", "Status"].join(","),
      ...data.items.map((w) => [w.domain, w.merchantName, w.health, w.crawlStatus, w.products, w.sslStatus, w.status].join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "websites.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flx-col gap-4">
      <div className="flx-row items-start justify-between">
        <div>
          <div className="dash-breadcrumb">Website Registry</div>
          <h1 className="dash-title">Websites</h1>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>+ Add Website</Button>
      </div>

      <WebsiteFilters
        search={search} status={status} crawler={crawler} merchant={merchant}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        onStatus={(v) => { setStatus(v); setPage(1); }}
        onCrawler={(v) => { setCrawler(v); setPage(1); }}
        onMerchant={(v) => { setMerchant(v); setPage(1); }}
        onExport={handleExport}
      />

      {loading ? (
        <div className="flx-center py-20"><Spinner size="lg" /></div>
      ) : error ? (
        <div className="dash-error"><p>{error}</p><Button variant="secondary" size="sm" onClick={fetchData}>Retry</Button></div>
      ) : !data ? null : (
        <>
          <WebsiteTable items={data.items} onSuspend={handleSuspend} onDelete={handleDelete} />

          {data.totalPages > 1 && (
            <div className="flx-row items-center justify-between">
              <span className="text-sm text-ink-soft">{data.total} websites total</span>
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

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Register Website" size="md">
        <div className="space-y-3">
          <Input label="Website URL" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://example.com" />
          <Input label="Merchant ID" value={newOrgId} onChange={(e) => setNewOrgId(e.target.value)} placeholder="Organization UUID" />
          <p className="text-xs text-ink-soft">The domain will be normalized and checked for duplicates. One active website = one workspace.</p>
          <div className="flx-row gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={adding} disabled={!newUrl.trim() || !newOrgId.trim()} onClick={handleAdd}>Register</Button>
          </div>
        </div>
      </Modal>

      <DuplicateWarning
        open={dupWarning.open}
        onClose={() => setDupWarning({ ...dupWarning, open: false })}
        domain={dupWarning.domain}
        owner={dupWarning.owner}
        status={dupWarning.status}
      />
    </div>
  );
}
