"use client";

import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api/request";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import type { SupportDashboard, SupportTicketItem } from "@/lib/support/types";

const statusColor: Record<string, "default" | "teal" | "rust" | "gold" | "sage" | "outline"> = { OPEN: "gold", IN_PROGRESS: "teal", RESOLVED: "sage", CLOSED: "default" };
const priorityColor: Record<string, "default" | "teal" | "rust" | "gold" | "sage" | "outline"> = { LOW: "default", NORMAL: "default", HIGH: "gold", CRITICAL: "rust" };

export default function SupportPage() {
  const [dash, setDash] = useState<SupportDashboard | null>(null);
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"dashboard" | "tickets">("dashboard");

  useEffect(() => {
    Promise.all([
      apiRequest<SupportDashboard>("/api/admin/support?dashboard=true"),
      apiRequest<SupportTicketItem[]>("/api/admin/support?limit=20"),
    ]).then(([d, t]) => {
      if (d.ok) setDash(d.data);
      if (t.ok) setTickets(Array.isArray(t.data) ? t.data : ((t.data as any)?.items || []));
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flx-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="flx-col gap-4">
      <div className="dash-header">
        <div>
          <div className="dash-breadcrumb">Support</div>
          <h1 className="dash-title">Support Ops Center</h1>
        </div>
      </div>

      <div className="flx-row gap-1 border-b border-border pb-2">
        {(["dashboard", "tickets"] as const).map((t) => (
          <button key={t} className={`px-3 py-1.5 text-sm font-medium rounded-t ${tab === t ? "bg-paper-raised border border-border border-b-transparent text-teal-deep" : "text-ink-soft hover:text-ink"}`} onClick={() => setTab(t)}>
            {t === "dashboard" ? "Dashboard" : "All Tickets"}
          </button>
        ))}
      </div>

      {tab === "dashboard" && dash && (
        <>
          <div className="dash-grid-3col">
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold text-gold">{dash.openTickets}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Open</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold text-teal-deep">{dash.inProgressTickets}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">In Progress</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold text-sage">{dash.resolvedToday}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Resolved Today</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold text-rust">{dash.criticalOpen}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Critical Open</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold">{dash.unassignedTickets}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Unassigned</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold">{dash.avgResolutionHours}h</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Avg Resolution</div>
            </div>
          </div>

          <div className="dash-grid-2col">
            <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
              <div className="px-4 py-3 border-b border-border font-semibold text-sm">By Status</div>
              {dash.statusBreakdown.map((s) => (
                <div key={s.status} className="px-4 py-3 flx-row justify-between items-center border-b border-border last:border-0">
                  <Badge variant={statusColor[s.status]} size="sm">{s.status.replace(/_/g, " ")}</Badge>
                  <span className="text-sm font-mono">{s.count}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
              <div className="px-4 py-3 border-b border-border font-semibold text-sm">By Priority</div>
              {dash.priorityBreakdown.map((p) => (
                <div key={p.priority} className="px-4 py-3 flx-row justify-between items-center border-b border-border last:border-0">
                  <Badge variant={priorityColor[p.priority] || "default"} size="sm">{p.priority}</Badge>
                  <span className="text-sm font-mono">{p.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Recent Tickets</div>
            <div className="divide-y divide-border">
              {dash.recentTickets.map((t) => (
                <div key={t.id} className="px-4 py-3 flx-row justify-between items-center">
                  <div className="flx-row gap-2 items-center min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${t.priority === "CRITICAL" ? "bg-rust" : t.priority === "HIGH" ? "bg-gold" : "bg-ink-soft"}`} />
                    <div className="min-w-0">
                      <div className="text-sm truncate">{t.subject}</div>
                      <div className="text-xs text-ink-soft">{t.orgId.slice(0, 8)} · {t.assigneeName || "Unassigned"}</div>
                    </div>
                  </div>
                  <div className="flx-row gap-2 items-center shrink-0">
                    <Badge variant={statusColor[t.status] || "default"} size="sm">{t.status.replace(/_/g, " ")}</Badge>
                    <span className="text-xs text-ink-soft">{t.messageCount} msgs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === "tickets" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">All Tickets</div>
          <div className="divide-y divide-border">
            {tickets.map((t) => (
              <div key={t.id} className="px-4 py-3 flx-row justify-between items-center">
                <div className="flx-row gap-2 items-center min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${t.priority === "CRITICAL" ? "bg-rust" : t.priority === "HIGH" ? "bg-gold" : "bg-ink-soft"}`} />
                  <div className="min-w-0">
                    <div className="text-sm truncate">{t.subject}</div>
                    <div className="text-xs text-ink-soft">{t.assigneeName || "Unassigned"} · {new Date(t.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="flx-row gap-2 items-center shrink-0">
                  <Badge variant={priorityColor[t.priority] || "default"} size="sm">{t.priority}</Badge>
                  <Badge variant={statusColor[t.status] || "default"} size="sm">{t.status.replace(/_/g, " ")}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
