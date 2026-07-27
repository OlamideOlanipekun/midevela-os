"use client";

import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api/request";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { QueueDashboard, QueueJobItem, WorkerHealth, DeadLetterItem } from "@/lib/queue/types";

export default function QueuePage() {
  const [dash, setDash] = useState<QueueDashboard | null>(null);
  const [jobs, setJobs] = useState<QueueJobItem[]>([]);
  const [workers, setWorkers] = useState<WorkerHealth[]>([]);
  const [deadLetters, setDeadLetters] = useState<DeadLetterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"dashboard" | "jobs" | "workers" | "deadletter">("dashboard");

  useEffect(() => {
    Promise.all([
      apiRequest<QueueDashboard>("/api/admin/queues"),
      apiRequest<QueueJobItem[]>("/api/admin/jobs?limit=10"),
      apiRequest<WorkerHealth[]>("/api/admin/workers"),
      apiRequest<DeadLetterItem[]>("/api/admin/jobs?status=FAILED&limit=5"),
    ]).then(([d, j, w, dl]) => {
      if (d.ok) setDash(d.data);
      if (j.ok) setJobs(Array.isArray(j.data) ? j.data : ((j.data as any)?.items || []));
      if (w.ok) setWorkers(Array.isArray(w.data) ? w.data : []);
      if (dl.ok) setDeadLetters(Array.isArray(dl.data) ? dl.data : []);
      setLoading(false);
    });
  }, []);

  const handleRetry = async (id: string) => {
    await apiRequest("/api/admin/jobs/retry", { method: "POST", body: JSON.stringify({ id }) });
    const j = await apiRequest<QueueJobItem[]>("/api/admin/jobs?limit=10");
    if (j.ok) setJobs(Array.isArray(j.data) ? j.data : ((j.data as any)?.items || []));
  };

  if (loading) return <div className="flx-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="flx-col gap-4">
      <div className="dash-header">
        <div>
          <div className="dash-breadcrumb">Queue Monitor</div>
          <h1 className="dash-title">Queue & Worker Operations Center</h1>
        </div>
      </div>

      <div className="flx-row gap-1 border-b border-border pb-2">
        {(["dashboard", "jobs", "workers", "deadletter"] as const).map((t) => (
          <button key={t} className={`px-3 py-1.5 text-sm font-medium rounded-t ${tab === t ? "bg-paper-raised border border-border border-b-transparent text-teal-deep" : "text-ink-soft hover:text-ink"}`} onClick={() => setTab(t)}>
            {t === "dashboard" ? "Dashboard" : t === "jobs" ? "Jobs" : t === "workers" ? "Workers" : "Dead Letter"}
          </button>
        ))}
      </div>

      {tab === "dashboard" && dash && (
        <>
          <div className="dash-grid-3col">
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold">{dash.runningJobs}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Running Jobs</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold">{dash.queued}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Queued</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold text-teal">{dash.completed.toLocaleString()}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Completed</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold text-rust">{dash.failed}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Failed</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold text-gold">{dash.retrying}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Retrying</div>
            </div>
          </div>

          {/* Queue Status List */}
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Queue Health</div>
            <div className="divide-y divide-border">
              {dash.queues.map((q) => (
                <div key={q.name} className="px-4 py-3 flx-row justify-between items-center">
                  <div className="flx-row gap-2 items-center">
                    <span className={`w-2 h-2 rounded-full ${q.status === "Healthy" ? "bg-teal" : "bg-gold"}`} />
                    <span className="text-sm font-medium capitalize">{q.name}</span>
                  </div>
                  <div className="flx-row gap-4 text-xs font-mono text-ink-soft">
                    <span>{q.running} running</span>
                    <span>{q.queued} queued</span>
                    {q.failed > 0 && <span className="text-rust">{q.failed} failed</span>}
                    <Badge variant={q.status === "Healthy" ? "teal" : "gold"} size="sm">{q.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Jobs */}
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Recent Jobs</div>
            <div className="divide-y divide-border">
              {jobs.slice(0, 5).map((j) => (
                <div key={j.id} className="px-4 py-3 flx-row justify-between items-center">
                  <div>
                    <div className="text-sm font-medium">{j.type}</div>
                    <div className="text-xs text-ink-soft">{j.queue} · {j.attempts}/{j.maxAttempts} attempts</div>
                  </div>
                  <div className="flx-row gap-2 items-center">
                    <Badge variant={j.status === "COMPLETED" ? "teal" : j.status === "FAILED" ? "rust" : j.status === "RUNNING" ? "sage" : j.status === "RETRYING" ? "gold" : "default"} size="sm">{j.status}</Badge>
                    {j.status === "FAILED" && <Button variant="secondary" size="sm" onClick={() => handleRetry(j.id)}>Retry</Button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === "jobs" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">All Jobs</div>
          <div className="divide-y divide-border">
            {jobs.map((j) => (
              <div key={j.id} className="px-4 py-3">
                <div className="flx-row justify-between items-center">
                  <div>
                    <div className="text-sm font-medium">{j.type}</div>
                    <div className="text-xs text-ink-soft">Queue: {j.queue} · Worker: {j.worker || "Unassigned"} · Duration: {j.duration}ms</div>
                  </div>
                  <div className="flx-row gap-2 items-center">
                    <Badge variant={j.status === "COMPLETED" ? "teal" : j.status === "FAILED" ? "rust" : j.status === "RUNNING" ? "sage" : "default"} size="sm">{j.status}</Badge>
                    {j.status === "FAILED" && <Button variant="secondary" size="sm" onClick={() => handleRetry(j.id)}>Retry</Button>}
                  </div>
                </div>
                {j.error && <pre className="text-xs text-rust mt-1 whitespace-pre-wrap">{j.error}</pre>}
                <div className="text-xs text-ink-soft mt-1">{new Date(j.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "workers" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Worker Health</div>
          <div className="divide-y divide-border">
            {workers.map((w) => (
              <div key={w.worker} className="px-4 py-3">
                <div className="flx-row justify-between items-center">
                  <div className="text-sm font-medium">{w.worker}</div>
                  <div className="flx-row gap-3 text-xs font-mono text-ink-soft">
                    <span>CPU: {w.cpu}%</span>
                    <span>RAM: {w.ram}%</span>
                    <span>Jobs: {w.runningJobs}</span>
                    <span>Errors: {w.errors}</span>
                  </div>
                </div>
                <div className="flx-row gap-4 mt-1 text-xs text-ink-soft">
                  <span>Avg Duration: {w.avgDuration}ms</span>
                  <span>Restarts: {w.restartCount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "deadletter" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Dead Letter Queue</div>
          <div className="divide-y divide-border">
            {deadLetters.map((d) => (
              <div key={d.id} className="px-4 py-3">
                <div className="flx-row justify-between items-center">
                  <div>
                    <div className="text-sm font-medium">{d.type}</div>
                    <div className="text-xs text-ink-soft">Queue: {d.queue} · {d.attempts} attempts</div>
                  </div>
                  <div className="text-xs text-ink-soft">{new Date(d.failedAt).toLocaleString()}</div>
                </div>
                {d.error && <pre className="text-xs text-rust mt-1">{d.error}</pre>}
              </div>
            ))}
            {deadLetters.length === 0 && <div className="px-4 py-6 text-sm text-ink-soft text-center">No dead letters</div>}
          </div>
        </div>
      )}
    </div>
  );
}
