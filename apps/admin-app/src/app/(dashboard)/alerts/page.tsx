"use client";

import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api/request";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { AlertDashboard, AlertItem, AlertRuleItem } from "@/lib/alerts/types";

export default function AlertsPage() {
  const [dash, setDash] = useState<AlertDashboard | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [rules, setRules] = useState<AlertRuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"dashboard" | "alerts" | "rules">("dashboard");

  useEffect(() => {
    Promise.all([
      apiRequest<AlertDashboard>("/api/admin/alerts?dashboard=true"),
      apiRequest<AlertItem[]>("/api/admin/alerts?limit=20"),
      apiRequest<AlertRuleItem[]>("/api/admin/alerts/rules"),
    ]).then(([d, a, r]) => {
      if (d.ok) setDash(d.data);
      if (a.ok) setAlerts(Array.isArray(a.data) ? a.data : ((a.data as any)?.items || []));
      if (r.ok) setRules(Array.isArray(r.data) ? r.data : []);
      setLoading(false);
    });
  }, []);

  const handleAcknowledge = async (id: string) => {
    await apiRequest("/api/admin/alerts/acknowledge", { method: "POST", body: JSON.stringify({ id, adminId: "admin" }) });
    const res = await apiRequest<AlertItem[]>("/api/admin/alerts?limit=20");
    if (res.ok) setAlerts(Array.isArray(res.data) ? res.data : ((res.data as any)?.items || []));
  };

  const handleResolve = async (id: string) => {
    await apiRequest("/api/admin/alerts/resolve", { method: "POST", body: JSON.stringify({ id }) });
    const res = await apiRequest<AlertItem[]>("/api/admin/alerts?limit=20");
    if (res.ok) setAlerts(Array.isArray(res.data) ? res.data : ((res.data as any)?.items || []));
  };

  if (loading) return <div className="flx-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="flx-col gap-4">
      <div className="dash-header">
        <div>
          <div className="dash-breadcrumb">Alerts</div>
          <h1 className="dash-title">Alert & Notification Center</h1>
        </div>
      </div>

      <div className="flx-row gap-1 border-b border-border pb-2">
        {(["dashboard", "alerts", "rules"] as const).map((t) => (
          <button key={t} className={`px-3 py-1.5 text-sm font-medium rounded-t ${tab === t ? "bg-paper-raised border border-border border-b-transparent text-teal-deep" : "text-ink-soft hover:text-ink"}`} onClick={() => setTab(t)}>
            {t === "dashboard" ? "Dashboard" : t === "alerts" ? "Alerts" : "Rules"}
          </button>
        ))}
      </div>

      {tab === "dashboard" && dash && (
        <>
          <div className="dash-grid-3col">
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold text-rust">{dash.critical}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Critical</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold text-gold">{dash.warning}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Warning</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold text-ink-soft">{dash.info}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Info</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold text-rust">{dash.open}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Open</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold text-gold">{dash.acknowledged}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Acknowledged</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold text-red">{dash.escalated}</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Escalated</div>
            </div>
          </div>

          {/* Alert Type Breakdown */}
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Alert Breakdown</div>
            <div className="divide-y divide-border">
              {dash.byType.map((b) => (
                <div key={b.type} className="px-4 py-3 flx-row justify-between items-center">
                  <span className="text-sm capitalize">{b.type.replace(/_/g, " ")}</span>
                  <span className="text-sm font-mono">{b.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Recent Alerts</div>
            <div className="divide-y divide-border">
              {alerts.slice(0, 5).map((a) => (
                <div key={a.id} className="px-4 py-3 flx-row justify-between items-center">
                  <div className="flx-row gap-2 items-center flex-1">
                    <span className={`w-2 h-2 rounded-full ${a.severity === "CRITICAL" ? "bg-rust" : a.severity === "WARNING" ? "bg-gold" : "bg-ink-soft"}`} />
                    <div>
                      <div className="text-sm">{a.title}</div>
                      <div className="text-xs text-ink-soft">{a.type} · {new Date(a.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flx-row gap-2 items-center">
                    <Badge variant={a.status === "OPEN" ? "rust" : a.status === "ACKNOWLEDGED" ? "gold" : a.status === "RESOLVED" ? "teal" : "default"} size="sm">{a.status}</Badge>
                    {a.status === "OPEN" && <Button variant="secondary" size="sm" onClick={() => handleAcknowledge(a.id)}>Ack</Button>}
                    {a.status !== "RESOLVED" && <Button variant="secondary" size="sm" onClick={() => handleResolve(a.id)}>Resolve</Button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === "alerts" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">All Alerts</div>
          <div className="divide-y divide-border">
            {alerts.map((a) => (
              <div key={a.id} className="px-4 py-3">
                <div className="flx-row justify-between items-center">
                  <div className="flx-row gap-2 items-center flex-1">
                    <span className={`w-2 h-2 rounded-full ${a.severity === "CRITICAL" ? "bg-rust" : a.severity === "WARNING" ? "bg-gold" : "bg-ink-soft"}`} />
                    <div>
                      <div className="text-sm font-medium">{a.title}</div>
                      <div className="text-xs text-ink-soft">{a.type} · {a.orgId ? `Merchant: ${a.orgId.slice(0, 8)}` : "Platform"}</div>
                    </div>
                  </div>
                  <div className="flx-row gap-2 items-center">
                    <Badge variant={a.severity === "CRITICAL" ? "rust" : a.severity === "WARNING" ? "gold" : "default"} size="sm">{a.severity}</Badge>
                    <Badge variant={a.status === "OPEN" ? "rust" : a.status === "ACKNOWLEDGED" ? "gold" : a.status === "RESOLVED" ? "teal" : "default"} size="sm">{a.status}</Badge>
                  </div>
                </div>
                {a.message && <div className="text-xs text-ink-soft mt-1 ml-4">{a.message}</div>}
                <div className="flx-row gap-2 mt-2 ml-4">
                  {a.status === "OPEN" && <Button variant="secondary" size="sm" onClick={() => handleAcknowledge(a.id)}>Acknowledge</Button>}
                  {a.status !== "RESOLVED" && <Button variant="secondary" size="sm" onClick={() => handleResolve(a.id)}>Resolve</Button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "rules" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Alert Rules</div>
          <div className="divide-y divide-border">
            {rules.map((r) => (
              <div key={r.id} className="px-4 py-3 flx-row justify-between items-center">
                <div>
                  <div className="text-sm font-medium">{r.name}</div>
                  <div className="text-xs text-ink-soft">{r.type} · Cooldown: {r.cooldown}s · {r.description || ""}</div>
                </div>
                <div className="flx-row gap-2 items-center">
                  <Badge variant={r.severity === "CRITICAL" ? "rust" : r.severity === "WARNING" ? "gold" : "default"} size="sm">{r.severity}</Badge>
                  <Badge variant={r.active ? "teal" : "default"} size="sm">{r.active ? "Active" : "Inactive"}</Badge>
                </div>
              </div>
            ))}
            {rules.length === 0 && <div className="px-4 py-6 text-sm text-ink-soft text-center">No alert rules configured</div>}
          </div>
        </div>
      )}
    </div>
  );
}
