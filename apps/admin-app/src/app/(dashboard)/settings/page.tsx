"use client";

import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api/request";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import type { SettingsDashboard, SystemConfigItem, IntegrationConfigItem, EmailTemplateItem } from "@/lib/settings/types";

export default function SettingsPage() {
  const [dash, setDash] = useState<SettingsDashboard | null>(null);
  const [configs, setConfigs] = useState<SystemConfigItem[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationConfigItem[]>([]);
  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"general" | "integrations" | "email">("general");

  useEffect(() => {
    Promise.all([
      apiRequest<SettingsDashboard>("/api/admin/settings?dashboard=true"),
      apiRequest<SystemConfigItem[]>("/api/admin/settings"),
      apiRequest<IntegrationConfigItem[]>("/api/admin/settings/integrations"),
      apiRequest<EmailTemplateItem[]>("/api/admin/settings/email-templates"),
    ]).then(([d, c, i, t]) => {
      if (d.ok) setDash(d.data);
      if (c.ok) setConfigs(Array.isArray(c.data) ? c.data : []);
      if (i.ok) setIntegrations(Array.isArray(i.data) ? i.data : []);
      if (t.ok) setTemplates(Array.isArray(t.data) ? t.data : []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flx-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="flx-col gap-4">
      <div className="dash-header">
        <div>
          <div className="dash-breadcrumb">Settings</div>
          <h1 className="dash-title">Platform Settings</h1>
        </div>
      </div>

      {dash && (
        <div className="dash-grid-4col">
          <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-1">
            <div className="text-2xl font-bold">{dash.configCount}</div>
            <div className="text-xs text-ink-soft uppercase tracking-wide">Config Keys</div>
          </div>
          <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-1">
            <div className="text-2xl font-bold">{dash.integrationCount}</div>
            <div className="text-xs text-ink-soft uppercase tracking-wide">Integrations</div>
          </div>
          <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-1">
            <div className="text-2xl font-bold text-sage">{dash.activeIntegrations}</div>
            <div className="text-xs text-ink-soft uppercase tracking-wide">Active</div>
          </div>
          <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-1">
            <div className="text-2xl font-bold">{dash.templateCount}</div>
            <div className="text-xs text-ink-soft uppercase tracking-wide">Email Templates</div>
          </div>
        </div>
      )}

      <div className="flx-row gap-1 border-b border-border pb-2">
        {(["general", "integrations", "email"] as const).map((t) => (
          <button key={t} className={`px-3 py-1.5 text-sm font-medium rounded-t ${tab === t ? "bg-paper-raised border border-border border-b-transparent text-teal-deep" : "text-ink-soft hover:text-ink"}`} onClick={() => setTab(t)}>
            {t === "general" ? "General" : t === "integrations" ? "Integrations" : "Email Templates"}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">System Configuration</div>
          <div className="divide-y divide-border">
            {configs.map((c) => (
              <div key={c.id} className="px-4 py-3 flx-row justify-between items-center">
                <div>
                  <div className="text-sm font-medium">{c.key}</div>
                  <div className="text-xs text-ink-soft">{c.description || c.category}</div>
                </div>
                <div className="text-sm font-mono max-w-[200px] truncate">{typeof c.value === "string" ? c.value : JSON.stringify(c.value).slice(0, 40)}</div>
              </div>
            ))}
            {configs.length === 0 && <div className="px-4 py-6 text-sm text-ink-soft text-center">No configuration keys yet. Seed data to populate.</div>}
          </div>
        </div>
      )}

      {tab === "integrations" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Third-Party Integrations</div>
          <div className="divide-y divide-border">
            {integrations.map((i) => (
              <div key={i.id} className="px-4 py-3 flx-row justify-between items-center">
                <div className="flx-row gap-3 items-center">
                  <div className={`w-2 h-2 rounded-full ${i.enabled ? "bg-sage" : "bg-ink-soft"}`} />
                  <div>
                    <div className="text-sm font-medium">{i.label}</div>
                    <div className="text-xs text-ink-soft">{i.provider}{i.testStatus ? ` · Last test: ${i.testStatus}` : ""}</div>
                  </div>
                </div>
                <Badge variant={i.enabled ? "sage" : "outline"} size="sm">{i.enabled ? "Enabled" : "Disabled"}</Badge>
              </div>
            ))}
            {integrations.length === 0 && <div className="px-4 py-6 text-sm text-ink-soft text-center">No integrations configured.</div>}
          </div>
        </div>
      )}

      {tab === "email" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Email Templates</div>
          <div className="divide-y divide-border">
            {templates.map((t) => (
              <div key={t.id} className="px-4 py-3">
                <div className="flx-row justify-between items-center">
                  <div>
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-ink-soft">{t.slug} · Subject: {t.subject}</div>
                  </div>
                  <div className="text-xs text-ink-soft">{t.variables.length} variables</div>
                </div>
              </div>
            ))}
            {templates.length === 0 && <div className="px-4 py-6 text-sm text-ink-soft text-center">No email templates yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
