"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api/request";
import { WebsiteHeader } from "@/components/websites/WebsiteHeader";
import { OverviewTab } from "@/components/websites/OverviewTab";
import { WebsiteHealthSection } from "@/components/websites/WebsiteHealthSection";
import { CrawlMonitor } from "@/components/websites/CrawlMonitor";
import { CrawlHistory } from "@/components/websites/CrawlHistory";
import { ProductsSummary } from "@/components/websites/ProductsSummary";
import { KnowledgeSummary } from "@/components/websites/KnowledgeSummary";
import { AnalyticsTab } from "@/components/websites/AnalyticsTab";
import { TransferModal } from "@/components/websites/TransferModal";
import { Spinner } from "@/components/ui/Spinner";
import type { WebsiteDetail, CrawlJobItem, WebsiteHealthData, WebsiteAnalyticsData } from "@/lib/websites/types";

type Tab = "overview" | "health" | "crawler" | "products" | "knowledge" | "analytics" | "history" | "settings";

const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "health", label: "Health" },
  { id: "crawler", label: "Crawler" },
  { id: "products", label: "Products" },
  { id: "knowledge", label: "Knowledge" },
  { id: "analytics", label: "Analytics" },
  { id: "history", label: "History" },
  { id: "settings", label: "Settings" },
];

export default function WebsiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [detail, setDetail] = useState<WebsiteDetail | null>(null);
  const [health, setHealth] = useState<WebsiteHealthData | null>(null);
  const [crawls, setCrawls] = useState<CrawlJobItem[]>([]);
  const [analytics, setAnalytics] = useState<WebsiteAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [detailRes, healthRes, crawlsRes, analyticsRes] = await Promise.all([
        apiRequest<WebsiteDetail>(`/api/admin/websites/${id}`),
        apiRequest<WebsiteHealthData | null>(`/api/admin/websites/${id}/health`),
        apiRequest<CrawlJobItem[]>(`/api/admin/websites/${id}/crawls?limit=20`),
        apiRequest<WebsiteAnalyticsData>(`/api/admin/websites/${id}/analytics`),
      ]);

      if (detailRes.ok) setDetail(detailRes.data);
      else { setError("Failed to load website"); setLoading(false); return; }
      if (healthRes.ok) setHealth(healthRes.data);
      if (crawlsRes.ok) setCrawls(crawlsRes.data);
      if (analyticsRes.ok) setAnalytics(analyticsRes.data);
    } catch {
      setError("Failed to load website data");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleVerify = async () => {
    await apiRequest(`/api/admin/websites/${id}/verify`, { method: "POST" });
    fetchAll();
  };

  const handleRecrawl = async () => {
    await apiRequest(`/api/admin/websites/${id}/recrawl`, { method: "POST" });
    fetchAll();
  };

  const handleSuspend = async () => {
    await apiRequest(`/api/admin/websites/${id}/suspend`, { method: "PATCH" });
    fetchAll();
  };

  const handleReactivate = async () => {
    await apiRequest(`/api/admin/websites/${id}/reactivate`, { method: "PATCH" });
    fetchAll();
  };

  const handleDelete = async () => {
    await apiRequest(`/api/admin/websites/${id}/delete`, { method: "DELETE" });
    router.push("/websites");
  };

  const handleTransfer = async (newOrgId: string) => {
    await apiRequest(`/api/admin/websites/${id}/transfer`, {
      method: "PATCH",
      body: JSON.stringify({ newOrgId }),
    });
    fetchAll();
  };

  if (loading) return <div className="flx-center py-20"><Spinner size="lg" /></div>;
  if (error || !detail) return <div className="dash-error"><p>{error || "Website not found"}</p></div>;

  const renderTab = () => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab website={detail} />;
      case "health":
        return <WebsiteHealthSection data={health} />;
      case "crawler":
        return (
          <div className="space-y-4">
            <CrawlMonitor jobs={detail.recentCrawls} />
            <CrawlHistory items={crawls} />
          </div>
        );
      case "products":
        return <ProductsSummary count={detail.products} />;
      case "knowledge":
        return <KnowledgeSummary count={detail.knowledgeEntries} />;
      case "analytics":
        return <AnalyticsTab data={analytics} />;
      case "history":
        return (
          <div className="stat-card">
            <h3 className="stat-title">Crawl History</h3>
            <div className="mt-2"><CrawlHistory items={crawls} /></div>
          </div>
        );
      case "settings":
        return (
          <div className="stat-card">
            <h3 className="stat-title">Website Settings</h3>
            <div className="mt-2 space-y-3">
              <div className="ws-field">
                <span className="ws-label">Domain</span>
                <span className="ws-value">{detail.domain}</span>
              </div>
              <div className="ws-field">
                <span className="ws-label">Normalized URL</span>
                <span className="ws-value">{detail.normalizedUrl}</span>
              </div>
              <div className="ws-field">
                <span className="ws-label">Verification</span>
                <span className="ws-value">{detail.verified ? "Verified" : "Not verified"}</span>
              </div>
              <div className="ws-field">
                <span className="ws-label">Created</span>
                <span className="ws-value">{new Date(detail.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="ws-field">
                <span className="ws-label">Updated</span>
                <span className="ws-value">{new Date(detail.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flx-col gap-4">
      <WebsiteHeader
        website={detail}
        onVerify={handleVerify}
        onRecrawl={handleRecrawl}
        onSuspend={handleSuspend}
        onReactivate={handleReactivate}
        onDelete={handleDelete}
        onTransfer={() => setShowTransfer(true)}
      />

      <div className="tabs-bar">
        {tabs.map((t) => (
          <button key={t.id} className={`tab-btn${activeTab === t.id ? " active" : ""}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="tab-content">{renderTab()}</div>

      <TransferModal open={showTransfer} onClose={() => setShowTransfer(false)} onTransfer={handleTransfer} />
    </div>
  );
}
