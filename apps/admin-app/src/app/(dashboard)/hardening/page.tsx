"use client";

import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api/request";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import type { HardeningDashboard, ApiKeyItem, IpRuleItem, RateLimitItem } from "@/lib/security/types";

export default function HardeningPage() {
  const [dash, setDash] = useState<HardeningDashboard | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [ipRules, setIpRules] = useState<IpRuleItem[]>([]);
  const [rateLimits, setRateLimits] = useState<RateLimitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"dashboard" | "keys" | "ips" | "limits">("dashboard");

  useEffect(() => {
    Promise.all([
      apiRequest<HardeningDashboard>("/api/admin/hardening?dashboard=true"),
      apiRequest<ApiKeyItem[]>("/api/admin/hardening?type=api-keys"),
      apiRequest<IpRuleItem[]>("/api/admin/hardening?type=ip-rules"),
      apiRequest<RateLimitItem[]>("/api/admin/hardening?type=rate-limits"),
    ]).then(([d, k, ip, rl]) => {
      if (d.ok) setDash(d.data);
      if (k.ok) setApiKeys(Array.isArray(k.data) ? k.data : []);
      if (ip.ok) setIpRules(Array.isArray(ip.data) ? ip.data : []);
      if (rl.ok) setRateLimits(Array.isArray(rl.data) ? rl.data : []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flx-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="flx-col gap-4">
      <div className="dash-header">
        <div>
          <div className="dash-breadcrumb">Hardening</div>
          <h1 className="dash-title">Production Hardening</h1>
        </div>
      </div>

      {dash && (
        <div className="dash-grid-4col">
          <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-1">
            <div className="text-2xl font-bold">{dash.totalApiKeys}</div>
            <div className="text-xs text-ink-soft uppercase tracking-wide">API Keys</div>
          </div>
          <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-1">
            <div className="text-2xl font-bold text-sage">{dash.activeApiKeys}</div>
            <div className="text-xs text-ink-soft uppercase tracking-wide">Active Keys</div>
          </div>
          <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-1">
            <div className="text-2xl font-bold text-rust">{dash.blockedIps}</div>
            <div className="text-xs text-ink-soft uppercase tracking-wide">Blocked IPs</div>
          </div>
          <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-1">
            <div className="text-2xl font-bold">{dash.rateLimitOverrides}</div>
            <div className="text-xs text-ink-soft uppercase tracking-wide">Rate Limit Overrides</div>
          </div>
        </div>
      )}

      <div className="flx-row gap-1 border-b border-border pb-2">
        {(["dashboard", "keys", "ips", "limits"] as const).map((t) => (
          <button key={t} className={`px-3 py-1.5 text-sm font-medium rounded-t ${tab === t ? "bg-paper-raised border border-border border-b-transparent text-teal-deep" : "text-ink-soft hover:text-ink"}`} onClick={() => setTab(t)}>
            {t === "dashboard" ? "Dashboard" : t === "keys" ? "API Keys" : t === "ips" ? "IP Rules" : "Rate Limits"}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <>
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Recent API Keys</div>
            <div className="divide-y divide-border">
              {dash?.recentApiKeys.map((k) => (
                <div key={k.id} className="px-4 py-3 flx-row justify-between items-center">
                  <div>
                    <div className="text-sm"><span className="font-medium">{k.name}</span> · {k.keyPrefix}***</div>
                    <div className="text-xs text-ink-soft">{k.scopes.join(", ") || "no scopes"}</div>
                  </div>
                  <Badge variant={k.active ? "sage" : "rust"} size="sm">{k.active ? "Active" : "Revoked"}</Badge>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">IP Rules</div>
            <div className="divide-y divide-border">
              {dash?.ipRules.map((r) => (
                <div key={r.id} className="px-4 py-3 flx-row justify-between items-center">
                  <div>
                    <div className="text-sm font-mono">{r.cidr}</div>
                    <div className="text-xs text-ink-soft">{r.reason || "No reason"}</div>
                  </div>
                  <Badge variant={r.action === "BLOCK" ? "rust" : "sage"} size="sm">{r.action}</Badge>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === "keys" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">API Keys</div>
          <div className="divide-y divide-border">
            {apiKeys.map((k) => (
              <div key={k.id} className="px-4 py-3 flx-row justify-between items-center">
                <div>
                  <div className="text-sm font-medium">{k.name}</div>
                  <div className="text-xs text-ink-soft">{k.keyPrefix}*** · Scopes: {k.scopes.join(", ") || "none"}{k.lastUsedAt ? ` · Last used: ${new Date(k.lastUsedAt).toLocaleDateString()}` : ""}</div>
                </div>
                <Badge variant={k.active ? "sage" : "rust"} size="sm">{k.active ? "Active" : "Revoked"}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "ips" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">IP Rules</div>
          <div className="divide-y divide-border">
            {ipRules.map((r) => (
              <div key={r.id} className="px-4 py-3 flx-row justify-between items-center">
                <div>
                  <div className="text-sm font-mono">{r.cidr}</div>
                  <div className="text-xs text-ink-soft">{r.reason || "No reason"}{r.expiresAt ? ` · Expires: ${new Date(r.expiresAt).toLocaleDateString()}` : ""}</div>
                </div>
                <Badge variant={r.action === "BLOCK" ? "rust" : "sage"} size="sm">{r.action}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "limits" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Rate Limit Overrides</div>
          <div className="divide-y divide-border">
            {rateLimits.map((rl) => (
              <div key={rl.id} className="px-4 py-3 flx-row justify-between items-center">
                <div>
                  <div className="text-sm font-mono">{rl.route}</div>
                  <div className="text-xs text-ink-soft">{rl.description || ""}</div>
                </div>
                <div className="text-sm font-mono">{rl.requests} req / {rl.windowSecs}s</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
