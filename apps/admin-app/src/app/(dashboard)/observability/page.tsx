"use client";

import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api/request";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import type { ObservabilityDashboard, AIFeedbackItem, AIExperimentItem, AIMonitorItem } from "@/lib/observability/types";

export default function ObservabilityPage() {
  const [dash, setDash] = useState<ObservabilityDashboard | null>(null);
  const [feedback, setFeedback] = useState<AIFeedbackItem[]>([]);
  const [experiments, setExperiments] = useState<AIExperimentItem[]>([]);
  const [monitor, setMonitor] = useState<AIMonitorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"dashboard" | "feedback" | "experiments" | "monitor">("dashboard");

  useEffect(() => {
    Promise.all([
      apiRequest<ObservabilityDashboard>("/api/admin/observability?dashboard=true"),
      apiRequest<AIFeedbackItem[]>("/api/admin/observability?type=feedback&limit=20"),
      apiRequest<AIExperimentItem[]>("/api/admin/observability?type=experiments"),
      apiRequest<AIMonitorItem[]>("/api/admin/observability?type=monitor"),
    ]).then(([d, f, e, m]) => {
      if (d.ok) setDash(d.data);
      if (f.ok) setFeedback(Array.isArray(f.data) ? f.data : ((f.data as any)?.items || []));
      if (e.ok) setExperiments(Array.isArray(e.data) ? e.data : []);
      if (m.ok) setMonitor(Array.isArray(m.data) ? m.data : []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flx-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="flx-col gap-4">
      <div className="dash-header">
        <div>
          <div className="dash-breadcrumb">Observability</div>
          <h1 className="dash-title">AI Observability</h1>
        </div>
      </div>

      {dash && (
        <div className="dash-grid-4col">
          <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-1">
            <div className="text-2xl font-bold">{dash.totalFeedback}</div>
            <div className="text-xs text-ink-soft uppercase tracking-wide">Feedback Entries</div>
          </div>
          <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-1">
            <div className="text-2xl font-bold">{dash.avgRating}</div>
            <div className="text-xs text-ink-soft uppercase tracking-wide">Avg Rating</div>
          </div>
          <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-1">
            <div className="text-2xl font-bold text-teal-deep">{dash.activeExperiments}</div>
            <div className="text-xs text-ink-soft uppercase tracking-wide">Active Experiments</div>
          </div>
        </div>
      )}

      <div className="flx-row gap-1 border-b border-border pb-2">
        {(["dashboard", "feedback", "experiments", "monitor"] as const).map((t) => (
          <button key={t} className={`px-3 py-1.5 text-sm font-medium rounded-t ${tab === t ? "bg-paper-raised border border-border border-b-transparent text-teal-deep" : "text-ink-soft hover:text-ink"}`} onClick={() => setTab(t)}>
            {t === "dashboard" ? "Dashboard" : t === "feedback" ? "Feedback" : t === "experiments" ? "Experiments" : "Monitor"}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <>
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Recent AI Feedback</div>
            <div className="divide-y divide-border">
              {dash?.recentFeedback.map((f) => (
                <div key={f.id} className="px-4 py-3 flx-row justify-between items-center">
                  <div>
                    <div className="text-sm capitalize">{f.category} · Rating: {"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)}</div>
                    <div className="text-xs text-ink-soft">{f.comment || "No comment"}</div>
                  </div>
                  <span className="text-xs text-ink-soft">{new Date(f.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Latest Monitor Snapshots</div>
            <div className="divide-y divide-border">
              {dash?.recentSnapshots.slice(0, 5).map((s) => (
                <div key={s.id} className="px-4 py-3 flx-row justify-between items-center">
                  <div>
                    <div className="text-sm font-medium">{s.model}</div>
                    <div className="text-xs text-ink-soft">{s.totalRequests} req · {s.avgLatency.toFixed(0)}ms avg · {s.errorRate.toFixed(1)}% err</div>
                  </div>
                  <div className="text-sm font-mono">${Number(s.cost).toFixed(4)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === "feedback" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">AI Feedback</div>
          <div className="divide-y divide-border">
            {feedback.map((f) => (
              <div key={f.id} className="px-4 py-3 flx-row justify-between items-center">
                <div>
                  <div className="text-sm"><span className="capitalize">{f.category}</span> · {"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)}</div>
                  <div className="text-xs text-ink-soft">{f.comment || "No comment"}{f.conversationId ? ` · ${f.conversationId.slice(0, 8)}` : ""}</div>
                </div>
                <span className="text-xs text-ink-soft">{new Date(f.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "experiments" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">A/B Experiments</div>
          <div className="divide-y divide-border">
            {experiments.map((e) => (
              <div key={e.id} className="px-4 py-3 flx-row justify-between items-center">
                <div>
                  <div className="text-sm font-medium">{e.name}</div>
                  <div className="text-xs text-ink-soft">{e.modelA} vs {e.modelB} · {e.trafficPercent}/{100 - e.trafficPercent} split · {e.totalSamples} samples{e.winner ? ` · Winner: ${e.winner}` : ""}</div>
                </div>
                <Badge variant={e.active ? "teal" : "outline"} size="sm">{e.active ? "Active" : "Inactive"}</Badge>
              </div>
            ))}
            {experiments.length === 0 && <div className="px-4 py-6 text-sm text-ink-soft text-center">No experiments.</div>}
          </div>
        </div>
      )}

      {tab === "monitor" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Monitor Snapshots</div>
          <div className="divide-y divide-border">
            {monitor.map((s) => (
              <div key={s.id} className="px-4 py-3 flx-row justify-between items-center">
                <div>
                  <div className="text-sm font-medium">{s.model}</div>
                  <div className="text-xs text-ink-soft">{new Date(s.snapshotAt).toLocaleString()} · {s.totalRequests} requests</div>
                </div>
                <div className="text-right text-xs">
                  <div>Latency: {s.avgLatency.toFixed(0)}ms (p95: {s.p95Latency.toFixed(0)}ms)</div>
                  <div className={s.errorRate > 5 ? "text-rust" : "text-ink-soft"}>Errors: {s.errorRate.toFixed(1)}% · ${Number(s.cost).toFixed(4)}</div>
                </div>
              </div>
            ))}
            {monitor.length === 0 && <div className="px-4 py-6 text-sm text-ink-soft text-center">No monitor data yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
