"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api/request";
import { MerchantHeader } from "@/components/merchant/MerchantHeader";
import { OverviewTab } from "@/components/merchant/OverviewTab";
import { WorkspaceInfo } from "@/components/merchant/WorkspaceInfo";
import { WebsitePanel } from "@/components/merchant/WebsitePanel";
import { AITab } from "@/components/merchant/AITab";
import { BillingTab } from "@/components/merchant/BillingTab";
import { UsageTab } from "@/components/merchant/UsageTab";
import { ConversationTab } from "@/components/merchant/ConversationTab";
import { MerchantTimeline } from "@/components/merchant/MerchantTimeline";
import { MerchantNotes } from "@/components/merchant/MerchantNotes";
import { Spinner } from "@/components/ui/Spinner";
import type { MerchantDetail, MerchantAnalytics, MerchantAIData, MerchantConversationData, MerchantBilling, MerchantUsage, MerchantNoteItem, MerchantActivityItem } from "@/lib/merchant/types";

type Tab = "overview" | "ai" | "website" | "knowledge" | "products" | "conversations" | "billing" | "usage" | "activity" | "workspace" | "settings";

const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "ai", label: "AI" },
  { id: "website", label: "Website" },
  { id: "knowledge", label: "Knowledge" },
  { id: "products", label: "Products" },
  { id: "conversations", label: "Conversations" },
  { id: "billing", label: "Billing" },
  { id: "usage", label: "Usage" },
  { id: "activity", label: "Activity" },
  { id: "workspace", label: "Workspace" },
  { id: "settings", label: "Settings" },
];

export default function MerchantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [detail, setDetail] = useState<MerchantDetail | null>(null);
  const [analytics, setAnalytics] = useState<MerchantAnalytics | null>(null);
  const [aiData, setAiData] = useState<MerchantAIData | null>(null);
  const [convData, setConvData] = useState<MerchantConversationData | null>(null);
  const [billingData, setBillingData] = useState<MerchantBilling | null>(null);
  const [usageData, setUsageData] = useState<MerchantUsage | null>(null);
  const [notes, setNotes] = useState<MerchantNoteItem[]>([]);
  const [activity, setActivity] = useState<MerchantActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [detailRes, analyticsRes, aiRes, convRes, billingRes, usageRes, notesRes, activityRes] = await Promise.all([
        apiRequest<MerchantDetail>(`/api/admin/merchants/${id}`),
        apiRequest<MerchantAnalytics>(`/api/admin/merchants/${id}/analytics`),
        apiRequest<MerchantAIData>(`/api/admin/merchants/${id}/ai`),
        apiRequest<MerchantConversationData>(`/api/admin/merchants/${id}/conversations`),
        apiRequest<MerchantBilling>(`/api/admin/merchants/${id}/billing`),
        apiRequest<MerchantUsage>(`/api/admin/merchants/${id}/usage`),
        apiRequest<MerchantNoteItem[]>(`/api/admin/merchants/${id}/notes`),
        apiRequest<MerchantActivityItem[]>(`/api/admin/merchants/${id}/activity`),
      ]);

      if (detailRes.ok) setDetail(detailRes.data);
      else { setError("Failed to load merchant"); return; }

      if (analyticsRes.ok) setAnalytics(analyticsRes.data);
      if (aiRes.ok) setAiData(aiRes.data);
      if (convRes.ok) setConvData(convRes.data);
      if (billingRes.ok) setBillingData(billingRes.data);
      if (usageRes.ok) setUsageData(usageRes.data);
      if (notesRes.ok) setNotes(notesRes.data);
      if (activityRes.ok) setActivity(activityRes.data);
    } catch {
      setError("Failed to load merchant data");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleLoginAs = async () => {
    const res = await apiRequest<{ token: string; expiresIn: number }>(`/api/admin/merchants/${id}/login-as`, { method: "POST" });
    if (res.ok) {
      window.open(`/api/auth/impersonate?token=${res.data.token}`, "_blank");
    }
  };

  const handleSuspend = async () => {
    await apiRequest(`/api/admin/merchants/${id}/suspend`, { method: "PATCH" });
    fetchAll();
  };

  const handleReactivate = async () => {
    await apiRequest(`/api/admin/merchants/${id}/reactivate`, { method: "PATCH" });
    fetchAll();
  };

  const handleDelete = async () => {
    await apiRequest(`/api/admin/merchants/${id}/delete`, { method: "DELETE" });
    router.push("/merchants");
  };

  const handleAddNote = async (content: string) => {
    const res = await apiRequest<MerchantNoteItem>(`/api/admin/merchants/${id}/notes`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      setNotes((prev) => [res.data, ...prev]);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    await apiRequest(`/api/admin/merchants/${id}/notes/${noteId}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  };

  const handleTogglePinNote = async (noteId: string) => {
    await apiRequest(`/api/admin/merchants/${id}/notes/${noteId}/pin`, { method: "PATCH" });
    setNotes((prev) => prev.map((n) => n.id === noteId ? { ...n, pinned: !n.pinned } : n));
  };

  if (loading) {
    return <div className="flx-center py-20"><Spinner size="lg" /></div>;
  }

  if (error || !detail) {
    return <div className="dash-error"><p>{error || "Merchant not found"}</p></div>;
  }

  const renderTab = () => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab detail={detail} analytics={analytics} />;

      case "ai":
        return <AITab data={aiData} />;

      case "website":
        return <WebsitePanel websites={detail.websites} />;

      case "conversations":
        return <ConversationTab data={convData} />;

      case "billing":
        return <BillingTab data={billingData} />;

      case "usage":
        return <UsageTab data={usageData} />;

      case "workspace":
        return <WorkspaceInfo merchant={detail} />;

      case "activity":
        return (
          <div className="stat-card">
            <h3 className="stat-title">Activity Timeline</h3>
            <div className="mt-2">
              <MerchantTimeline items={activity} />
            </div>
          </div>
        );

      case "knowledge":
        return (
          <div className="stat-card">
            <h3 className="stat-title">Knowledge Base</h3>
            <p className="text-sm text-ink-soft mt-2">{detail.knowledgeEntries} documents uploaded.</p>
          </div>
        );

      case "products":
        return (
          <div className="stat-card">
            <h3 className="stat-title">Products</h3>
            <p className="text-sm text-ink-soft mt-2">{detail.products} products catalogued.</p>
          </div>
        );

      case "settings":
        return (
          <div className="stat-card">
            <h3 className="stat-title">Merchant Settings</h3>
            <div className="mt-2">
              <MerchantNotes
                notes={notes}
                onAdd={handleAddNote}
                onDelete={handleDeleteNote}
                onTogglePin={handleTogglePinNote}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flx-col gap-4">
      <MerchantHeader
        merchant={detail}
        onLoginAs={handleLoginAs}
        onSuspend={handleSuspend}
        onReactivate={handleReactivate}
        onDelete={handleDelete}
      />

      <div className="tabs-bar">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`tab-btn${activeTab === t.id ? " active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {renderTab()}
      </div>
    </div>
  );
}
