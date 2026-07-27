"use client";

import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api/request";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import type { AnalyticsDashboard, RevenueAnalytics, MerchantAnalytics, ConversationAnalyticsData, CustomerAnalytics, FunnelAnalytics, ForecastData, ReportItem } from "@/lib/analytics/types";

export default function AnalyticsPage() {
  const [dash, setDash] = useState<AnalyticsDashboard | null>(null);
  const [revenue, setRevenue] = useState<RevenueAnalytics | null>(null);
  const [merchants, setMerchants] = useState<MerchantAnalytics | null>(null);
  const [conversations, setConversations] = useState<ConversationAnalyticsData | null>(null);
  const [customer, setCustomer] = useState<CustomerAnalytics | null>(null);
  const [funnel, setFunnel] = useState<FunnelAnalytics | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"dashboard" | "funnel" | "forecast" | "reports">("dashboard");

  useEffect(() => {
    Promise.all([
      apiRequest<AnalyticsDashboard>("/api/admin/analytics"),
      apiRequest<RevenueAnalytics>("/api/admin/analytics/revenue"),
      apiRequest<MerchantAnalytics>("/api/admin/analytics/merchants"),
      apiRequest<ConversationAnalyticsData>("/api/admin/analytics/conversations"),
      apiRequest<ForecastData>("/api/admin/analytics/forecast?metric=revenue"),
      apiRequest<ReportItem[]>("/api/admin/reports"),
    ]).then(([d, r, m, c, f, rp]) => {
      if (d.ok) setDash(d.data);
      if (r.ok) setRevenue(r.data);
      if (m.ok) setMerchants(m.data);
      if (c.ok) setConversations(c.data);
      if (f.ok) setForecast(f.data);
      if (rp.ok) setReports(Array.isArray(rp.data) ? rp.data : []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flx-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="flx-col gap-4">
      <div className="dash-header">
        <div>
          <div className="dash-breadcrumb">Analytics</div>
          <h1 className="dash-title">Analytics Intelligence Center</h1>
        </div>
      </div>

      <div className="flx-row gap-1 border-b border-border pb-2">
        {(["dashboard", "funnel", "forecast", "reports"] as const).map((t) => (
          <button key={t} className={`px-3 py-1.5 text-sm font-medium rounded-t ${tab === t ? "bg-paper-raised border border-border border-b-transparent text-teal-deep" : "text-ink-soft hover:text-ink"}`} onClick={() => setTab(t)}>
            {t === "dashboard" ? "Dashboard" : t === "funnel" ? "Funnel" : t === "forecast" ? "Forecast" : "Reports"}
          </button>
        ))}
      </div>

      {tab === "dashboard" && dash && (
        <>
          <div className="dash-grid-3col">
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold text-teal">₦{(dash.revenue / 1e6).toFixed(1)}M</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Revenue</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold">{(dash.conversations / 1e6).toFixed(1)}M</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Conversations</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold">{(dash.recommendations / 1e6).toFixed(1)}M</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Recommendations</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold text-teal">{dash.conversionRate}%</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Conversion Rate</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold text-teal">{dash.aiAccuracy}%</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">AI Accuracy</div>
            </div>
            <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
              <div className="text-2xl font-bold text-teal">{dash.customerSatisfaction}%</div>
              <div className="text-xs text-ink-soft uppercase tracking-wide">Customer Satisfaction</div>
            </div>
          </div>

          {revenue && (
            <div className="dash-grid-3col">
              <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
                <div className="text-lg font-bold text-teal">₦{(revenue.mrr / 1e6).toFixed(1)}M</div>
                <div className="text-xs text-ink-soft uppercase tracking-wide">MRR</div>
              </div>
              <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
                <div className="text-lg font-bold">₦{(revenue.arr / 1e6).toFixed(1)}M</div>
                <div className="text-xs text-ink-soft uppercase tracking-wide">ARR</div>
              </div>
              <div className="p-4 rounded-xl border border-border bg-paper-raised flx-col gap-2">
                <div className="text-lg font-bold text-gold">₦{revenue.refunds.toLocaleString()}</div>
                <div className="text-xs text-ink-soft uppercase tracking-wide">Refunds</div>
              </div>
            </div>
          )}

          {merchants && (
            <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
              <div className="px-4 py-3 border-b border-border font-semibold text-sm">Merchant Analytics</div>
              <div className="p-4 flx-row gap-6 flex-wrap">
                <div><span className="text-lg font-bold">{merchants.active}</span><span className="text-xs text-ink-soft ml-1">Active</span></div>
                <div><span className="text-lg font-bold">{merchants.inactive}</span><span className="text-xs text-ink-soft ml-1">Inactive</span></div>
                <div><span className="text-lg font-bold text-teal">{merchants.growth}%</span><span className="text-xs text-ink-soft ml-1">Growth</span></div>
                <div><span className="text-lg font-bold text-rust">{merchants.churn}%</span><span className="text-xs text-ink-soft ml-1">Churn</span></div>
                <div><span className="text-lg font-bold">₦{merchants.averageRevenue.toLocaleString()}</span><span className="text-xs text-ink-soft ml-1">Avg Revenue</span></div>
                <div><span className="text-lg font-bold">{merchants.averageAiScore}%</span><span className="text-xs text-ink-soft ml-1">Avg AI Score</span></div>
              </div>
            </div>
          )}

          {conversations && (
            <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
              <div className="px-4 py-3 border-b border-border font-semibold text-sm">Conversation Analytics</div>
              <div className="p-4 flx-row gap-6 flex-wrap">
                <div><span className="text-lg font-bold">{conversations.started.toLocaleString()}</span><span className="text-xs text-ink-soft ml-1">Started</span></div>
                <div><span className="text-lg font-bold text-teal">{conversations.resolved.toLocaleString()}</span><span className="text-xs text-ink-soft ml-1">Resolved</span></div>
                <div><span className="text-lg font-bold text-gold">{conversations.escalated}</span><span className="text-xs text-ink-soft ml-1">Escalated</span></div>
                <div><span className="text-lg font-bold">{conversations.avgDuration}s</span><span className="text-xs text-ink-soft ml-1">Avg Duration</span></div>
                <div><span className="text-lg font-bold">{conversations.avgMessages}</span><span className="text-xs text-ink-soft ml-1">Avg Messages</span></div>
                <div><span className="text-lg font-bold">{conversations.avgResponseTime}s</span><span className="text-xs text-ink-soft ml-1">Response Time</span></div>
              </div>
            </div>
          )}

          {/* Conversion Funnel Preview */}
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Conversion Funnel</div>
            <div className="divide-y divide-border">
              {dash.conversionFunnel.map((s) => (
                <div key={s.stage} className="px-4 py-3 flx-row items-center gap-4">
                  <div className="w-28 text-sm font-medium">{s.stage}</div>
                  <div className="flex-1 h-3 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full bg-teal" style={{ width: `${s.conversion}%` }} />
                  </div>
                  <div className="text-sm font-mono w-20 text-right">{s.users.toLocaleString()}</div>
                  <div className="text-xs text-ink-soft w-20 text-right">{s.conversion.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === "funnel" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Full Funnel Analysis</div>
          <div className="divide-y divide-border">
            {dash?.conversionFunnel.map((s) => (
              <div key={s.stage} className="px-4 py-4">
                <div className="flx-row justify-between items-center mb-2">
                  <div className="text-sm font-semibold">{s.stage}</div>
                  <div className="text-sm font-mono">{s.users.toLocaleString()} users</div>
                </div>
                <div className="h-4 rounded-full bg-border overflow-hidden mb-1">
                  <div className="h-full rounded-full bg-teal" style={{ width: `${s.conversion}%` }} />
                </div>
                <div className="flx-row gap-4 text-xs text-ink-soft">
                  <span>Dropoff: {s.dropoff.toLocaleString()} ({s.users > 0 ? ((s.dropoff / s.users) * 100).toFixed(1) : 0}%)</span>
                  <span>Conversion: {s.conversion.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "forecast" && (
        <div className="flx-col gap-4">
          <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">Revenue Forecast</div>
            <div className="p-4">
              {forecast ? (
                <div className="flx-col gap-3">
                  <div className="flx-row gap-4 text-sm">
                    <span>Metric: <strong>{forecast.metric}</strong></span>
                    <span>Period: <strong>{forecast.period}</strong></span>
                    <span>Confidence: <strong className="text-teal">{forecast.confidence}%</strong></span>
                  </div>
                  <div className="space-y-2 mt-2">
                    {forecast.values.map((v, i) => (
                      <div key={i} className="flx-row justify-between items-center p-2 rounded-lg bg-paper border border-border">
                        <span className="text-sm">{v.date}</span>
                        <div className="flx-row gap-3 items-center">
                          <span className="text-sm font-mono font-semibold">₦{v.value.toLocaleString()}</span>
                          {v.lower && <span className="text-xs text-ink-soft">L:₦{v.lower.toLocaleString()}</span>}
                          {v.upper && <span className="text-xs text-ink-soft">U:₦{v.upper.toLocaleString()}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-ink-soft">No forecast data available. Generate forecasts from the backend.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "reports" && (
        <div className="rounded-xl border border-border bg-paper-raised overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-sm">Custom Reports</div>
          <div className="divide-y divide-border">
            {reports.map((r) => (
              <div key={r.id} className="px-4 py-3 flx-row justify-between items-center">
                <div>
                  <div className="text-sm font-medium">{r.name}</div>
                  <div className="text-xs text-ink-soft">{r.slug} · Schedule: {r.schedule}</div>
                </div>
                <div className="text-xs text-ink-soft">{r.lastRunAt ? new Date(r.lastRunAt).toLocaleDateString() : "Never run"}</div>
              </div>
            ))}
            {reports.length === 0 && <div className="px-4 py-6 text-sm text-ink-soft text-center">No reports created yet</div>}
          </div>
        </div>
      )}
    </div>
  );
}
