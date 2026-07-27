"use client";

import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api/request";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { AuditDashboard, AuditLogItem, SecurityEventItem, ComplianceExportItem } from "@/lib/audit/types";

export default function AuditPage() {
  const [dash, setDash] = useState<AuditDashboard | null>(null);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"dashboard" | "logs" | "security">("dashboard");
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      apiRequest<AuditDashboard>("/api/admin/audit?dashboard=true"),
      apiRequest<AuditLogItem[]>("/api/admin/audit?limit=20"),
      apiRequest<SecurityEventItem[]>("/api/admin/security?limit=10"),
    ]).then(([d, l, s]) => {
      if (d.ok) setDash(d.data);
      if (l.ok) setLogs(Array.isArray(l.data) ? l.data : ((l.data as any)?.items || []));
      if (s.ok) setSecurityEvents(Array.isArray(s.data) ? s.data : ((s.data as any)?.items || []));
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flx-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="flx-col gap-4">
      <div className="dash-header">
        <div>
          <div className="dash-breadcrumb">Audit</div>
          <h1 className="dash-title">Audit & Compliance Center</h1>
        </div>
      </div>

      <div className="flx-row gap-1 border-b border-border pb-2">
        {(["dashboard", "logs", "security"] as const).map((t) => (
          <button key={t} className={`px-3 py-1.5 text-sm font-medium rounded-t ${tab === t ? "bg-paper-raised border border-border border-b-transparent text-teal-deep" : "text-ink-soft hover:text-ink"}`} onClick={() => setTab(t)}>
            {t === "dashboard" ? "Dashboard" : t === "logs" ? "Activity Log" : "Security Events"}
          </button>
        ))}
      </div>

      {tab === "dashboard" && dash && (
        <>
          <div className="dash-grid-3col">
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold">{dash.totalEvents.toLocaleString()}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Total Events</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold">{dash.uniqueAdmins}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Active Admins</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold">{dash.eventsToday}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Events Today</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold text-gold">{dash.securityEvents}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Security Events</div>
            </div>
          </div>

          {/* Top Actions */}
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Top Actions</div>
            <div className="divide-y divide-border">
              {dash.topActions.map((a) => (
                <div key={a.action} className="px-4 py-3 flx-row justify-between items-center">
                  <span className="text-sm capitalize">{a.action.replace(/_/g, " ")}</span>
                  <span className="text-sm font-mono">{a.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Modules */}
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Top Modules</div>
            <div className="divide-y divide-border">
              {dash.topModules.map((m) => (
                <div key={m.module} className="px-4 py-3 flx-row justify-between items-center">
                  <span className="text-sm capitalize">{m.module}</span>
                  <span className="text-sm font-mono">{m.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Logs */}
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Recent Activity</div>
            <div className="divide-y divide-border">
              {logs.slice(0, 5).map((l) => (
                <div key={l.id} className="px-4 py-3 flx-row justify-between items-center">
                  <div>
                    <div className="text-sm">{l.adminName || "System"} · <span className="capitalize">{l.action.replace(/_/g, " ")}</span></div>
                    <div className="text-xs text-ink-soft">{l.module} · {new Date(l.createdAt).toLocaleString()}</div>
                  </div>
                  {l.targetId && <span className="text-xs font-mono text-ink-soft">{l.targetId.slice(0, 8)}</span>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === "logs" && (
        <div className="flx-col gap-3">
          <div className="flx-row gap-2">
            <input className="flex-1 px-3 py-2 rounded-lg border border-border bg-paper text-sm outline-none focus:border-teal" placeholder="Search by action, module, or target..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Activity Log</div>
            <div className="divide-y divide-border">
              {logs.filter((l) => !search || l.action.includes(search) || l.module.includes(search) || (l.adminName || "").includes(search)).map((l) => (
                <div key={l.id} className="px-4 py-3">
                  <div className="flx-row justify-between items-center">
                    <div>
                      <div className="text-sm"><span className="font-medium">{l.adminName || "System"}</span> · <span className="capitalize">{l.action.replace(/_/g, " ")}</span></div>
                      <div className="text-xs text-ink-soft">Module: {l.module} · IP: {l.ip || "N/A"}</div>
                    </div>
                    <div className="text-xs text-ink-soft">{new Date(l.createdAt).toLocaleString()}</div>
                  </div>
                  {l.targetId && <div className="text-xs text-ink-soft mt-1">Target: {l.targetId}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "security" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Security Events</div>
          <div className="divide-y divide-border">
            {securityEvents.map((e) => (
              <div key={e.id} className="px-4 py-3">
                <div className="flx-row justify-between items-center">
                  <div className="flx-row gap-2 items-center">
                    <span className={`w-2 h-2 rounded-full ${e.severity === "critical" ? "bg-rust" : e.severity === "warning" ? "bg-gold" : "bg-ink-soft"}`} />
                    <div>
                      <div className="text-sm font-medium capitalize">{e.type.replace(/_/g, " ")}</div>
                      {e.detail && <div className="text-xs text-ink-soft">{e.detail}</div>}
                    </div>
                  </div>
                  <div className="flx-row gap-2 items-center">
                    <Badge variant={e.severity === "critical" ? "rust" : e.severity === "warning" ? "gold" : "default"} size="sm">{e.severity}</Badge>
                    <span className="text-xs text-ink-soft">{new Date(e.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
            {securityEvents.length === 0 && <div className="px-4 py-6 text-sm text-ink-soft text-center">No security events</div>}
          </div>
        </div>
      )}
    </div>
  );
}
