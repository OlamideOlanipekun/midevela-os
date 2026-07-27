"use client";

import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api/request";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { AIHealthData, PromptItem, ModelRouteItem, AIMetrics, AICostData, AIErrorItem, PromptDetail } from "@/lib/ai/types";

export default function AIOpsPage() {
  const [health, setHealth] = useState<AIHealthData | null>(null);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptDetail | null>(null);
  const [routes, setRoutes] = useState<ModelRouteItem[]>([]);
  const [metrics, setMetrics] = useState<AIMetrics | null>(null);
  const [costs, setCosts] = useState<AICostData | null>(null);
  const [errors, setErrors] = useState<AIErrorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"dashboard" | "prompts" | "routes" | "costs" | "errors">("dashboard");

  useEffect(() => {
    Promise.all([
      apiRequest<AIHealthData>("/api/admin/ai"),
      apiRequest<PromptItem[]>("/api/admin/ai/prompts?limit=10"),
      apiRequest<ModelRouteItem[]>("/api/admin/ai/models"),
      apiRequest<AIMetrics>("/api/admin/ai/metrics"),
      apiRequest<AICostData>("/api/admin/ai/costs"),
      apiRequest<AIErrorItem[]>("/api/admin/ai/errors?limit=5"),
    ]).then(([h, p, r, m, c, e]) => {
      if (h.ok) setHealth(h.data);
      if (p.ok) setPrompts(Array.isArray(p.data) ? p.data : ((p.data as any)?.items || []));
      if (r.ok) setRoutes(Array.isArray(r.data) ? r.data : []);
      if (m.ok) setMetrics(m.data);
      if (c.ok) setCosts(c.data);
      if (e.ok) setErrors(Array.isArray(e.data) ? e.data : ((e.data as any)?.items || []));
      setLoading(false);
    });
  }, []);

  const loadPrompt = async (id: string) => {
    const res = await apiRequest<PromptDetail>(`/api/admin/ai/prompts/${id}`);
    if (res.ok) setSelectedPrompt(res.data);
  };

  if (loading) return <div className="flx-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="flx-col gap-4">
      <div className="dash-header">
        <div>
          <div className="dash-breadcrumb">AI Operations</div>
          <h1 className="dash-title">AI Operations Center</h1>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="flx-row gap-1 border-b border-border pb-2">
        {(["dashboard", "prompts", "routes", "costs", "errors"] as const).map((t) => (
          <button key={t} className={`px-3 py-1.5 text-sm font-medium rounded-t ${tab === t ? "bg-paper-raised border border-border border-b-transparent text-teal-deep" : "text-ink-soft hover:text-ink"}`} onClick={() => setTab(t)}>
            {t === "dashboard" ? "Dashboard" : t === "prompts" ? "Prompts" : t === "routes" ? "Model Router" : t === "costs" ? "Costs" : "Errors"}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <>
          {/* AI Health */}
          {health && (
            <>
              <div className="dash-grid-3col">
                <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
                  <div className="text-2xl font-bold text-teal">{health.overallHealth}%</div>
                  <div className="text-xs text-ink-soft uppercase tracking-wide">AI Health</div>
                </div>
                <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
                  <div className="text-2xl font-bold">{health.avgConfidence}%</div>
                  <div className="text-xs text-ink-soft uppercase tracking-wide">Avg Confidence</div>
                </div>
                <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
                  <div className="text-2xl font-bold">{health.latency}s</div>
                  <div className="text-xs text-ink-soft uppercase tracking-wide">Latency</div>
                </div>
                <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
                  <div className="text-2xl font-bold">₦{health.dailyCost.toFixed(2)}</div>
                  <div className="text-xs text-ink-soft uppercase tracking-wide">Daily Cost</div>
                </div>
                <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
                  <div className="text-2xl font-bold">{health.hallucinationRate}%</div>
                  <div className="text-xs text-ink-soft uppercase tracking-wide">Hallucination Rate</div>
                </div>
                <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
                  <div className="text-2xl font-bold">{health.fallbackRate.toFixed(1)}%</div>
                  <div className="text-xs text-ink-soft uppercase tracking-wide">Fallback Rate</div>
                </div>
              </div>

              {/* Model Status */}
              <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
                <div className="px-4 py-3 border-b border-border font-semibold text-sm">Model Health</div>
                <div className="divide-y divide-border">
                  {health.models.map((m) => (
                    <div key={m.name} className="px-4 py-3 flx-row justify-between items-center">
                      <div className="flx-row gap-2 items-center">
                        <span className={`w-2 h-2 rounded-full ${m.status === "Healthy" ? "bg-teal" : "bg-gold"}`} />
                        <span className="text-sm font-medium">{m.name}</span>
                      </div>
                      <div className="flx-row gap-4 text-xs font-mono text-ink-soft">
                        <span>{m.healthScore}%</span>
                        <span>{m.latency}s</span>
                        <span>{m.errorRate}% err</span>
                        <Badge variant={m.status === "Healthy" ? "teal" : "gold"} size="sm">{m.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Prompts */}
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Prompts</div>
            <div className="divide-y divide-border">
              {prompts.map((p) => (
                <div key={p.id} className="px-4 py-3 flx-row justify-between items-center cursor-pointer hover:bg-black/[0.02]" onClick={() => { setTab("prompts"); loadPrompt(p.id); }}>
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-ink-soft">{p.key} · v{p.currentVersion}</div>
                  </div>
                  <Badge variant={p.status === "PUBLISHED" ? "teal" : p.status === "DRAFT" ? "gold" : "default"} size="sm">{p.status}</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Errors */}
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Recent AI Errors</div>
            <div className="divide-y divide-border">
              {errors.map((e) => (
                <div key={e.id} className="px-4 py-3 flx-row justify-between items-center">
                  <div>
                    <div className="text-sm">{e.type} on {e.model}</div>
                    {e.message && <div className="text-xs text-ink-soft">{e.message}</div>}
                  </div>
                  <div className="text-xs text-ink-soft">{new Date(e.createdAt).toLocaleTimeString()}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === "prompts" && (
        <div className="flx-row gap-4 items-start">
          <div className="flex-1 rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">All Prompts</div>
            <div className="divide-y divide-border">
              {prompts.map((p) => (
                <div key={p.id} className={`px-4 py-3 cursor-pointer hover:bg-black/[0.02] ${selectedPrompt?.id === p.id ? "bg-teal/5" : ""}`} onClick={() => loadPrompt(p.id)}>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-ink-soft">{p.key} · v{p.currentVersion} · {p.category}</div>
                </div>
              ))}
            </div>
          </div>
          {selectedPrompt && (
            <div className="flex-[2] rounded-xl border border-border bg-paper-raised overflow-hidden">
              <div className="px-4 py-3 border-b border-border font-semibold text-sm">{selectedPrompt.name} · v{selectedPrompt.currentVersion}</div>
              <div className="p-4">
                <div className="text-xs text-ink-soft mb-2">Status: {selectedPrompt.status} · Key: {selectedPrompt.key} · Category: {selectedPrompt.category}</div>
                <div className="space-y-2">
                  {selectedPrompt.versions.slice(0, 5).map((v) => (
                    <div key={v.id} className="p-3 rounded-lg border border-border bg-paper">
                      <div className="flx-row justify-between items-center mb-1">
                        <span className="text-xs font-semibold">v{v.version}</span>
                        <span className="text-xs text-ink-soft">{v.model} · {v.temperature} temp · {v.maxTokens} tokens</span>
                      </div>
                      <pre className="text-xs whitespace-pre-wrap max-h-32 overflow-y-auto text-ink-soft">{v.content.slice(0, 500)}{v.content.length > 500 ? "..." : ""}</pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "routes" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Model Router Configuration</div>
          <div className="divide-y divide-border">
            {routes.map((r) => (
              <div key={r.id} className="px-4 py-3 flx-row justify-between items-center">
                <div>
                  <div className="text-sm font-medium capitalize">{r.intent.replace(/_/g, " ")}</div>
                  <div className="text-xs text-ink-soft">Model: {r.model} · Fallback: {r.fallback || "None"} · Priority: {r.priority}</div>
                </div>
                <Badge variant={r.active ? "teal" : "default"} size="sm">{r.active ? "Active" : "Inactive"}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "costs" && (
        <div className="flx-col gap-4">
          <div className="dash-grid-3col">
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold">₦{costs?.totalToday.toFixed(2) || "0.00"}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Today</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold">₦{costs?.totalMonth.toFixed(2) || "0.00"}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">This Month</div>
            </div>
          </div>
          {costs?.perModel && costs.perModel.length > 0 && (
            <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
              <div className="px-4 py-3 border-b border-border font-semibold text-sm">Cost Per Model</div>
              <div className="divide-y divide-border">
                {costs.perModel.map((c, i) => (
                  <div key={i} className="px-4 py-3 flx-row justify-between items-center">
                    <span className="text-sm font-medium">{c.model}</span>
                    <span className="text-sm font-mono">₦{c.cost.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "errors" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">AI Errors</div>
          <div className="divide-y divide-border">
            {errors.map((e) => (
              <div key={e.id} className="px-4 py-3">
                <div className="flx-row justify-between items-center">
                  <div className="text-sm font-medium">{e.type}</div>
                  <span className="text-xs text-ink-soft">{new Date(e.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-xs text-ink-soft mt-1">Model: {e.model} · Status: {e.statusCode || "N/A"} · Latency: {e.latency ? `${e.latency}ms` : "N/A"}</div>
                {e.message && <pre className="text-xs text-red mt-1 whitespace-pre-wrap">{e.message}</pre>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
