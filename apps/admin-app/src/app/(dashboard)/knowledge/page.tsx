"use client";

import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api/request";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { KnowledgeHealth, DocumentItem, MissingAnswerItem, KnowledgeAnalytics, SearchResult } from "@/lib/knowledge/types";

export default function KnowledgePage() {
  const [health, setHealth] = useState<KnowledgeHealth | null>(null);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [analytics, setAnalytics] = useState<KnowledgeAnalytics | null>(null);
  const [missing, setMissing] = useState<MissingAnswerItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"dashboard" | "documents" | "missing" | "search">("dashboard");

  useEffect(() => {
    Promise.all([
      apiRequest<KnowledgeHealth>("/api/admin/knowledge/health"),
      apiRequest<DocumentItem[]>("/api/admin/knowledge?limit=5"),
      apiRequest<MissingAnswerItem[]>("/api/admin/knowledge/missing?limit=5"),
    ]).then(([h, d, m]) => {
      if (h.ok) setHealth(h.data);
      if (d.ok) setDocs(Array.isArray(d.data) ? d.data : ((d.data as any)?.items || []));
      if (m.ok) setMissing(Array.isArray(m.data) ? m.data : ((m.data as any)?.items || []));
      setLoading(false);
    });
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    const res = await apiRequest<SearchResult[]>("/api/admin/knowledge/search", {
      method: "POST",
      body: JSON.stringify({ orgId: "", query: searchQuery, limit: 10 }),
    });
    if (res.ok) setSearchResults(res.data);
  };

  if (loading) return <div className="flx-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="flx-col gap-4">
      <div className="dash-header">
        <div>
          <div className="dash-breadcrumb">Knowledge</div>
          <h1 className="dash-title">Knowledge Engine</h1>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="flx-row gap-1 border-b border-border pb-2">
        {(["dashboard", "documents", "missing", "search"] as const).map((t) => (
          <button key={t} className={`px-3 py-1.5 text-sm font-medium rounded-t ${tab === t ? "bg-paper-raised border border-border border-b-transparent text-teal-deep" : "text-ink-soft hover:text-ink"}`} onClick={() => setTab(t)}>
            {t === "dashboard" ? "Dashboard" : t === "documents" ? "Documents" : t === "missing" ? "Missing Answers" : "Search"}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <>
          {health && (
            <div className="dash-grid-3col">
              <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
                <div className="text-2xl font-bold text-teal">{health.healthScore}%</div>
                <div className="text-xs text-ink-soft uppercase tracking-wide">Knowledge Health</div>
              </div>
              <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
                <div className="text-2xl font-bold">{health.indexedDocuments.toLocaleString()}</div>
                <div className="text-xs text-ink-soft uppercase tracking-wide">Indexed Documents</div>
              </div>
              <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
                <div className="text-2xl font-bold">{health.totalChunks.toLocaleString()}</div>
                <div className="text-xs text-ink-soft uppercase tracking-wide">Chunks</div>
              </div>
              <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
                <div className="text-2xl font-bold">{health.totalEmbeddings.toLocaleString()}</div>
                <div className="text-xs text-ink-soft uppercase tracking-wide">Embeddings</div>
              </div>
              <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
                <div className="text-2xl font-bold">{health.coverage}%</div>
                <div className="text-xs text-ink-soft uppercase tracking-wide">Coverage</div>
              </div>
              <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
                <div className="text-2xl font-bold text-gold">{health.missingAnswerCount}</div>
                <div className="text-xs text-ink-soft uppercase tracking-wide">Missing Answers</div>
              </div>
            </div>
          )}

          {/* Recent Documents */}
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Recent Documents</div>
            <div className="divide-y divide-border">
              {docs.map((d) => (
                <div key={d.id} className="px-4 py-3 flx-row justify-between items-center">
                  <div>
                    <div className="text-sm font-medium">{d.title}</div>
                    <div className="text-xs text-ink-soft">{d.type} · {d.chunkCount} chunks · {d.totalTokens} tokens</div>
                  </div>
                  <Badge variant={d.status === "INDEXED" ? "teal" : d.status === "FAILED" ? "rust" : "gold"} size="sm">{d.status}</Badge>
                </div>
              ))}
              {docs.length === 0 && <div className="px-4 py-6 text-sm text-ink-soft text-center">No documents yet</div>}
            </div>
          </div>

          {/* Missing Answers */}
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Top Missing Answers</div>
            <div className="divide-y divide-border">
              {missing.map((m) => (
                <div key={m.id} className="px-4 py-3">
                  <div className="text-sm">{m.question}</div>
                  <div className="text-xs text-ink-soft mt-1">Frequency: {m.frequency} · {m.status}</div>
                </div>
              ))}
              {missing.length === 0 && <div className="px-4 py-6 text-sm text-ink-soft text-center">No missing answers</div>}
            </div>
          </div>
        </>
      )}

      {tab === "documents" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">All Documents</div>
          <div className="divide-y divide-border">
            {docs.map((d) => (
              <div key={d.id} className="px-4 py-3 flx-row justify-between items-center hover:bg-black/[0.02]">
                <div>
                  <div className="text-sm font-medium">{d.title}</div>
                  <div className="text-xs text-ink-soft">{d.type} · {d.chunkCount} chunks · {d.source}</div>
                </div>
                <div className="flx-row gap-2 items-center">
                  <Badge variant={d.status === "INDEXED" ? "teal" : d.status === "FAILED" ? "rust" : "gold"} size="sm">{d.status}</Badge>
                  <span className="text-xs text-ink-soft">{new Date(d.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "missing" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Missing Answers</div>
          <div className="divide-y divide-border">
            {missing.map((m) => (
              <div key={m.id} className="px-4 py-3">
                <div className="flx-row justify-between items-start">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{m.question}</div>
                    {m.context && <div className="text-xs text-ink-soft mt-1">{m.context}</div>}
                  </div>
                  <Badge variant={m.status === "open" ? "gold" : "teal"} size="sm">{m.status}</Badge>
                </div>
                <div className="flx-row gap-3 mt-2 text-xs text-ink-soft">
                  <span>Asked {m.frequency}x</span>
                  {m.suggestedSource && <span>Source: {m.suggestedSource}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "search" && (
        <div className="flx-col gap-4">
          <div className="flx-row gap-2">
            <input
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-paper text-sm outline-none focus:border-teal"
              placeholder="Search knowledge base..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button size="sm" onClick={handleSearch}>Search</Button>
          </div>
          {searchResults.length > 0 && (
            <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
              <div className="px-4 py-3 border-b border-border font-semibold text-sm">Results</div>
              <div className="divide-y divide-border">
                {searchResults.map((r) => (
                  <div key={r.chunkId} className="px-4 py-3">
                    <div className="flx-row justify-between items-start">
                      <div className="text-sm font-medium">{r.documentTitle}</div>
                      <div className="text-xs font-mono">{r.score}%</div>
                    </div>
                    <div className="text-xs text-ink-soft mt-1 line-clamp-2">{r.content}</div>
                    <div className="text-xs text-ink-soft mt-1">Similarity: {(r.similarity * 100).toFixed(0)}% · Source: {r.source}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
