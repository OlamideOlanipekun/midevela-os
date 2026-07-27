"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api/request";
import { ChatWindow } from "@/components/conversations/ChatWindow";
import { CustomerPanel } from "@/components/conversations/CustomerPanel";
import { AIInspector } from "@/components/conversations/AIInspector";
import { RecommendationPanel } from "@/components/conversations/RecommendationPanel";
import { SessionTimeline } from "@/components/conversations/SessionTimeline";
import { ConversationActions } from "@/components/conversations/ConversationActions";
import { ReplayControls } from "@/components/conversations/ReplayControls";
import { ExportModal } from "@/components/conversations/ExportModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import type { ConversationDetail, AIReasoning, RecommendationData } from "@/lib/conversations/types";

export default function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showReplay, setShowReplay] = useState(false);

  const fetchDetail = useCallback(async () => {
    const res = await apiRequest<ConversationDetail>(`/api/admin/conversations/${id}`);
    if (res.ok) setDetail(res.data);
    else setError("Failed to load conversation");
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleJoin = async () => {
    await apiRequest(`/api/admin/conversations/${id}/join`, { method: "POST" });
    fetchDetail();
  };

  const handleResumeAI = async () => {
    await apiRequest(`/api/admin/conversations/${id}/resume-ai`, { method: "POST" });
    fetchDetail();
  };

  const handleAddTag = async (tag: string) => {
    await apiRequest(`/api/admin/conversations/${id}/tags`, {
      method: "PATCH",
      body: JSON.stringify({ tag, action: "add" }),
    });
    fetchDetail();
  };

  if (loading) return <div className="flx-center py-20"><Spinner size="lg" /></div>;
  if (error || !detail) return <div className="dash-error"><p>{error || "Conversation not found"}</p></div>;

  const qualityColor = detail.qualityScore >= 85 ? "#22c55e" : detail.qualityScore >= 70 ? "#eab308" : detail.qualityScore >= 50 ? "#f97316" : "#ef4444";
  const aiReasoning: AIReasoning = { intent: detail.intent, knowledgeSources: [{ title: "Product Catalog" }, { title: "Shipping Policy" }], productsConsidered: [{ name: "Vitamin C Serum", price: 25000 }, { name: "Niacinamide Serum", price: 35000 }], productsRanked: [{ name: "Vitamin C Serum", score: 92 }, { name: "Niacinamide Serum", score: 78 }], recommended: { name: "Vitamin C Serum", reason: "Matches customer budget and preferences" }, confidence: detail.aiConfidence };
  const recData: RecommendationData = { productsConsidered: ["Vitamin C Serum", "Niacinamide Serum", "Hyaluronic Acid"], productsRanked: ["Vitamin C Serum", "Niacinamide Serum", "Hyaluronic Acid"], productSent: "Vitamin C Serum", customerClicked: true, purchased: false };

  return (
    <div className="flx-col gap-4">
      {/* Header */}
      <div className="flx-row items-start justify-between">
        <div>
          <div className="dash-breadcrumb">{detail.merchant.name} · {detail.customer.name || detail.customer.email || "Anonymous"}</div>
          <div className="flx-row gap-2 items-center mt-1">
            <h1 className="dash-title">Conversation</h1>
            <Badge variant={detail.status === "ACTIVE" ? "teal" : detail.status === "HANDED_OFF" ? "gold" : "default"} size="sm">{detail.status}</Badge>
            {detail.humanJoined && <Badge variant="sage" size="sm">Human</Badge>}
          </div>
        </div>
        <div className="flx-row gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowReplay((v) => !v)}>Replay</Button>
          <Button variant="secondary" size="sm" onClick={() => setShowExport(true)}>Export</Button>
          <ConversationActions conversationId={id} humanJoined={detail.humanJoined} aiPaused={detail.aiPaused} onJoin={handleJoin} onResumeAI={handleResumeAI} />
        </div>
      </div>

      {/* Quality Score bar */}
      <div className="flx-row gap-3 items-center px-4 py-2 rounded-lg" style={{ backgroundColor: `${qualityColor}15` }}>
        <div className="flx-row gap-2 items-center">
          <span className="text-sm font-semibold">Quality Score</span>
          <span className="text-lg font-bold font-mono" style={{ color: qualityColor }}>{detail.qualityScore}/100</span>
          <span className="text-xs text-ink-soft">{detail.qualityLabel}</span>
        </div>
        <div className="h-1.5 flex-1 rounded-full bg-border overflow-hidden max-w-[200px]">
          <div className="h-full rounded-full" style={{ width: `${detail.qualityScore}%`, backgroundColor: qualityColor }} />
        </div>
      </div>

      {/* Replay bar */}
      {showReplay && <ReplayControls events={detail.events} />}

      {/* Three-panel layout */}
      <div className="conv-layout">
        {/* Main chat */}
        <div className="conv-main">
          <div className="conv-main-hdr">
            <div className="flx-row gap-2">
              {detail.tags.map((t) => (
                <span key={t} className="conv-tag">{t}</span>
              ))}
              {detail.tags.length === 0 && <span className="text-xs text-ink-soft">No tags</span>}
            </div>
            {detail.merchant.name && (
              <p className="text-xs text-ink-soft">{detail.merchant.name} · {detail.intent.replace(/_/g, " ")} · AI {detail.aiConfidence}%</p>
            )}
          </div>
          <ChatWindow messages={detail.messages} />
        </div>

        {/* Right panel: Customer Profile + AI Inspector */}
        <div className="conv-sidebar">
          <CustomerPanel customer={detail.customer} />
          <div className="conv-sidebar-tabs">
            <button className="conv-stab active" onClick={() => {}}>AI</button>
          </div>
          <div className="conv-sidebar-content">
            <AIInspector data={aiReasoning} />
            <RecommendationPanel data={recData} />
            <SessionTimeline events={detail.events} />
          </div>

          {/* Quick tag */}
          <div className="panel-section">
            <h3 className="panel-title">Quick Tag</h3>
            <div className="flx-row gap-1 flex-wrap">
              {["Hot Lead", "VIP", "Abandoned Cart", "Refund", "Support"].map((t) => (
                <button key={t} className={`conv-tag-btn ${detail.tags.includes(t) ? "active" : ""}`} onClick={() => handleAddTag(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ExportModal open={showExport} onClose={() => setShowExport(false)} conversationId={id} />
    </div>
  );
}
