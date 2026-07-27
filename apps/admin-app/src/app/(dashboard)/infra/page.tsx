"use client";

import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api/request";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import type { InfraDashboard, InfraMetricItem, DeploymentItem, ScheduledTaskItem } from "@/lib/infra/types";

const deployColor: Record<string, string> = { SUCCESS: "sage", FAILED: "rust", IN_PROGRESS: "gold", PENDING: "default", ROLLED_BACK: "outline" };

export default function InfraPage() {
  const [dash, setDash] = useState<InfraDashboard | null>(null);
  const [deployments, setDeployments] = useState<DeploymentItem[]>([]);
  const [tasks, setTasks] = useState<ScheduledTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"dashboard" | "deployments" | "tasks">("dashboard");

  useEffect(() => {
    Promise.all([
      apiRequest<InfraDashboard>("/api/admin/infra?dashboard=true"),
      apiRequest<DeploymentItem[]>("/api/admin/infra?type=deployments&limit=20"),
      apiRequest<ScheduledTaskItem[]>("/api/admin/infra?type=tasks"),
    ]).then(([d, dep, t]) => {
      if (d.ok) setDash(d.data);
      if (dep.ok) setDeployments(Array.isArray(dep.data) ? dep.data : ((dep.data as any)?.items || []));
      if (t.ok) setTasks(Array.isArray(t.data) ? t.data : []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flx-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="flx-col gap-4">
      <div className="dash-header">
        <div>
          <div className="dash-breadcrumb">Infrastructure</div>
          <h1 className="dash-title">Infrastructure Ops</h1>
        </div>
      </div>

      {dash && (
        <div className="dash-grid-4col">
          <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-1">
            <div className="text-2xl font-bold">{dash.metricCount}</div>
            <div className="text-xs text-ink-soft uppercase tracking-wide">Metrics</div>
          </div>
          <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-1">
            <div className="text-2xl font-bold">{dash.deploymentCount}</div>
            <div className="text-xs text-ink-soft uppercase tracking-wide">Deployments</div>
          </div>
          <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-1">
            <div className="text-2xl font-bold text-sage">{dash.activeTasks}</div>
            <div className="text-xs text-ink-soft uppercase tracking-wide">Active Tasks</div>
          </div>
          <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-1">
            <div className="text-2xl font-bold text-rust">{dash.failedDeployments}</div>
            <div className="text-xs text-ink-soft uppercase tracking-wide">Failed</div>
          </div>
        </div>
      )}

      <div className="flx-row gap-1 border-b border-border pb-2">
        {(["dashboard", "deployments", "tasks"] as const).map((t) => (
          <button key={t} className={`px-3 py-1.5 text-sm font-medium rounded-t ${tab === t ? "bg-paper-raised border border-border border-b-transparent text-teal-deep" : "text-ink-soft hover:text-ink"}`} onClick={() => setTab(t)}>
            {t === "dashboard" ? "Dashboard" : t === "deployments" ? "Deployments" : "Scheduled Tasks"}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <>
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Latest Metrics</div>
            <div className="divide-y divide-border">
              {dash?.latestMetrics.map((m) => (
                <div key={m.id} className="px-4 py-3 flx-row justify-between items-center">
                  <div className="flx-row gap-2 items-center">
                    <span className={`w-2 h-2 rounded-full ${m.type === "cpu" ? "bg-teal" : m.type === "memory" ? "bg-gold" : m.type === "disk" ? "bg-sage" : "bg-ink-soft"}`} />
                    <div>
                      <div className="text-sm capitalize">{m.type} {m.label ? `· ${m.label}` : ""}</div>
                      <div className="text-xs text-ink-soft">{new Date(m.recordedAt).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="text-sm font-mono">{m.value}{m.unit === "percent" ? "%" : m.unit === "ms" ? "ms" : m.unit}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Recent Deployments</div>
            <div className="divide-y divide-border">
              {dash?.recentDeployments.map((d) => (
                <div key={d.id} className="px-4 py-3 flx-row justify-between items-center">
                  <div className="flx-row gap-2 items-center min-w-0">
                    <div className="min-w-0">
                      <div className="text-sm truncate">{d.service} · {d.version}</div>
                      <div className="text-xs text-ink-soft">{d.branch || "main"} · {d.author || "auto"}</div>
                    </div>
                  </div>
                  <div className="flx-row gap-2 items-center shrink-0">
                    <Badge variant={(deployColor[d.status] || "default") as any} size="sm">{d.status}</Badge>
                    <span className="text-xs text-ink-soft">{new Date(d.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === "deployments" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">All Deployments</div>
          <div className="divide-y divide-border">
            {deployments.map((d) => (
              <div key={d.id} className="px-4 py-3 flx-row justify-between items-center">
                <div>
                  <div className="text-sm"><span className="font-medium">{d.service}</span> · {d.version}</div>
                  <div className="text-xs text-ink-soft">{d.environment} · {d.author || "auto"}{d.duration ? ` · ${d.duration}s` : ""}</div>
                </div>
                <div className="flx-row gap-2 items-center">
                  <Badge variant={(deployColor[d.status] || "default") as any} size="sm">{d.status}</Badge>
                  <span className="text-xs text-ink-soft">{new Date(d.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "tasks" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Scheduled Tasks</div>
          <div className="divide-y divide-border">
            {tasks.map((t) => (
              <div key={t.id} className="px-4 py-3 flx-row justify-between items-center">
                <div>
                  <div className="text-sm"><span className="font-medium">{t.name}</span> · {t.cron}</div>
                  <div className="text-xs text-ink-soft">{t.description || t.type}{t.lastRunAt ? ` · Last: ${new Date(t.lastRunAt).toLocaleString()}` : ""}</div>
                </div>
                <div className="flx-row gap-2 items-center">
                  <Badge variant={t.active ? "sage" : "outline"} size="sm">{t.active ? "Active" : "Inactive"}</Badge>
                  {t.lastStatus && <Badge variant={t.lastStatus === "success" ? "sage" : "rust"} size="sm">{t.lastStatus}</Badge>}
                </div>
              </div>
            ))}
            {tasks.length === 0 && <div className="px-4 py-6 text-sm text-ink-soft text-center">No scheduled tasks.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
