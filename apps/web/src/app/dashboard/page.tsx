"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMockAuth } from "@/components/providers/MockAuthProvider";
import "./dashboard.css";

const renderActivityText = (name: string, text: string) => {
  const nameNode = name ? <strong style={{ fontWeight: 600 }}>{name} </strong> : null;
  const parts = text.split(/(<b>.*?<\/b>)/g);
  return (
    <span>
      {nameNode}
      {parts.map((part, i) => {
        if (part.startsWith("<b>") && part.endsWith("</b>")) {
          return <strong key={i} style={{ fontWeight: 600 }}>{part.slice(3, -4)}</strong>;
        }
        return part;
      })}
    </span>
  );
};

export default function DashboardHome() {
  const { user } = useMockAuth();
  const router = useRouter();
  
  const userName = user?.fullName || "Ola";
  const firstName = userName.split(" ")[0];
  
  const [greeting, setGreeting] = useState(`Good afternoon, ${firstName}.`);

  useEffect(() => {
    const hours = new Date().getHours();
    let greet = "Good morning";
    if (hours >= 12 && hours < 17) {
      greet = "Good afternoon";
    } else if (hours >= 17) {
      greet = "Good evening";
    }
    setGreeting(`${greet}, ${firstName}.`);
  }, [firstName]);

  // State management for interactions
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isAskAIModalOpen, setIsAskAIModalOpen] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Initial activities pool
  const initialActivities = [
    {
      id: "act-1",
      name: "Chiamaka O.",
      text: "completed a purchase — ClearGlow Routine Set, ₦24,500",
      time: "2 min ago · Instagram",
      color: "teal",
    },
    {
      id: "act-2",
      name: "",
      text: "High-intent visitor browsing <b>Vitamin C Serum</b> for 6 minutes",
      time: "5 min ago · Website",
      color: "amber",
    },
    {
      id: "act-3",
      name: "Tunde A.",
      text: "requested human assistance — 3 unanswered shipping questions",
      time: "11 min ago · WhatsApp",
      color: "rust",
    },
    {
      id: "act-4",
      name: "",
      text: 'Automation <b>"Abandoned Cart Recovery"</b> sent to 8 customers',
      time: "22 min ago · Automation",
      color: "teal",
    },
    {
      id: "act-5",
      name: "Funke B.",
      text: "started new conversation on Website",
      time: "31 min ago · Website",
      color: "teal",
    },
  ];

  const [activities, setActivities] = useState(initialActivities);

  // Live simulator for activity feed
  useEffect(() => {
    const simulationPool = [
      { name: "Funmi O.", text: "completed a purchase — Brightening C-Serum, ₦18,500", time: "Just now · Instagram", color: "teal" },
      { name: "", text: "New conversation started with <b>Kelechi E.</b> on WhatsApp", time: "Just now · WhatsApp", color: "teal" },
      { name: "", text: "High-intent visitor added <b>ClearGlow Routine Set</b> to cart", time: "Just now · Website", color: "amber" },
      { name: "", text: "Automation <b>\"Cart Abandonment SMS\"</b> sent to Yusuf A.", time: "Just now · Automation", color: "teal" },
      { name: "Bolanle A.", text: "completed a purchase — HydraSoothe Moisturizer, ₦12,000", time: "Just now · Website", color: "teal" },
      { name: "", text: "High-intent visitor browsing <b>Shipping Policy</b> for 4 minutes", time: "Just now · Website", color: "amber" }
    ];

    const interval = setInterval(() => {
      const randomChoice = simulationPool[Math.floor(Math.random() * simulationPool.length)];
      const randomActivity = { ...randomChoice, id: `sim-${Date.now()}-${Math.random()}` };
      setActivities(prev => {
        const updatedPrev = prev.map(act => {
          if (act.time.startsWith("Just now")) return { ...act, time: "1 min ago" };
          const minMatch = act.time.match(/^(\d+) min ago/);
          if (minMatch) {
            const nextMin = parseInt(minMatch[1]) + 1;
            return { ...act, time: `${nextMin} min ago` };
          }
          return act;
        });
        return [randomActivity, ...updatedPrev.slice(0, 4)];
      });
      setToastMessage("Live feed updated with new customer activity!");
      setTimeout(() => setToastMessage(null), 2500);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Listen to TopBar's Ask AI button event
  useEffect(() => {
    const handleOpenAskAI = () => {
      setIsAskAIModalOpen(true);
    };
    window.addEventListener("open-ask-ai", handleOpenAskAI);
    return () => window.removeEventListener("open-ask-ai", handleOpenAskAI);
  }, []);

  const handleAiSubmit = () => {
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    setAiResponse(null);

    setTimeout(() => {
      setAiLoading(false);
      const query = aiQuestion.toLowerCase();
      if (query.includes("shipping")) {
        setAiResponse("Based on visitor chat analysis, 9 unique customers requested international shipping details this week. I recommend creating a shipping policy in your Knowledge Base specifying rates for West Africa (Ghana, Senegal) and Europe. Estimated conversion uplift: +3.2%.");
      } else if (query.includes("conversion") || query.includes("confidence")) {
        setAiResponse("Your current checkout conversion rate is 4.8%. The primary drop-off occurs immediately after shipping calculations are presented. I recommend offering free shipping above ₦50,000 to recover approximately ₦68k in lost weekly revenue.");
      } else {
        setAiResponse("I have analyzed your store logs. Lumina Beauty Co. is currently seeing strong organic traffic (24 active visitors). The active conversation funnel shows a 12% purchase conversion. To optimize sales further, ensure your 'ClearGlow Routine Set' features automatic upsell recommendations during visitor checkout chats.");
      }
    }, 1200);
  };

  const handleQuickAction = (actionName: string) => {
    if (actionName === "Add Product") {
      router.push("/dashboard/products?action=add");
    } else if (actionName === "Import Catalog") {
      router.push("/dashboard/knowledge?tab=docs");
    } else if (actionName === "Launch Automation" || actionName === "Broadcast Campaign") {
      setToastMessage(`Quick Action: ${actionName} is coming soon in the next update!`);
      setTimeout(() => setToastMessage(null), 3500);
    } else if (actionName === "Invite Team Member") {
      router.push("/dashboard/settings?tab=team");
    } else if (actionName === "Connect Integration") {
      router.push("/dashboard/settings?tab=org");
    } else {
      setToastMessage(`Quick Action Triggered: ${actionName}`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleInsightAction = (action: string) => {
    if (action.includes("Join conversation")) {
      router.push("/dashboard/conversations");
    } else if (action.includes("Review checkout flow")) {
      router.push("/dashboard/analytics");
    } else if (action.includes("shipping policy")) {
      setAiQuestion("How do I add an international shipping policy?");
      setIsAskAIModalOpen(true);
    }
  };

  const kpis = [
    { label: "Revenue Today", value: "₦486k", delta: "▲ 14% vs yesterday", type: "up" },
    { label: "AI Revenue", value: "68%", delta: "▲ 6pt this week", type: "up" },
    { label: "Conversion Rate", value: "4.8%", delta: "▲ 0.6pt", type: "up" },
    { label: "Buying Confidence", value: "76", delta: "▼ 3pt", type: "down" },
    { label: "Lost Revenue", value: "₦92k", delta: "▼ checkout drop-off", type: "down" },
    { label: "AI Health", value: "98%", delta: "● nominal", type: "up" },
  ];

  const insights = [
    {
      tag: "Revenue opportunity",
      text: "9 customers asked about international shipping this week — there's no policy in your Knowledge Base to answer them.",
      action: "Add shipping policy →",
    },
    {
      tag: "Confidence drop",
      text: "Buying confidence falls sharply after shipping costs appear at checkout for 3 products.",
      action: "Review checkout flow →",
    },
    {
      tag: "High-value visitor",
      text: "A returning customer with ₦340k lifetime value needs assistance right now.",
      action: "Join conversation →",
    },
  ];

  const barChartHeights = [42, 58, 50, 71, 64, 100, 78];

  const funnelStages = [
    { label: "Visitors", pct: "100%", fillWidth: "100%", isHighlight: false },
    { label: "Engaged", pct: "64%", fillWidth: "64%", isHighlight: false },
    { label: "Recommended", pct: "41%", fillWidth: "41%", isHighlight: false },
    { label: "Checkout", pct: "18%", fillWidth: "18%", isHighlight: false },
    { label: "Purchased", pct: "12%", fillWidth: "12%", isHighlight: true },
  ];

  return (
    <div className="flex flex-col gap-xl" style={{ position: "relative" }}>
      {/* Toast Alert */}
      {toastMessage && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          background: "var(--ink)",
          color: "var(--paper)",
          padding: "12px 24px",
          borderRadius: "var(--radius-pill)",
          border: "1px solid var(--border)",
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
          zIndex: 1000,
          animation: "fadeIn 0.2s ease"
        }}>
          ⚡ {toastMessage}
        </div>
      )}

      {/* Ask AI Modal */}
      {isAskAIModalOpen && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(19, 32, 27, 0.7)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000
        }}>
          <div style={{
            background: "var(--paper-raised)",
            border: "2px solid var(--ink)",
            borderRadius: "var(--radius-lg)",
            padding: "28px",
            width: "100%",
            maxWidth: "500px",
            boxShadow: "0 20px 50px rgba(26,24,20,0.3)",
            position: "relative"
          }}>
            <button 
              onClick={() => {
                setIsAskAIModalOpen(false);
                setAiResponse(null);
                setAiQuestion("");
              }}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "none",
                border: "none",
                fontSize: "18px",
                cursor: "pointer",
                color: "var(--ink-soft)"
              }}
            >
              ✕
            </button>
            
            <h3 className="display" style={{ margin: "0 0 16px", fontSize: "20px", color: "var(--ink)" }}>Midevela AI Copilot</h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <label style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", color: "var(--ink-soft)" }}>
                What would you like to ask the commerce AI?
              </label>
              <input
                type="text"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                placeholder="Type e.g., 'shipping' or 'conversion'..."
                style={{
                  padding: "12px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "13.5px",
                  fontFamily: "var(--font-body)",
                  color: "var(--ink)",
                  background: "#fff",
                  outline: "none"
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAiSubmit();
                }}
              />
              
              <button 
                onClick={handleAiSubmit}
                disabled={aiLoading}
                style={{
                  background: "var(--ink)",
                  color: "var(--paper)",
                  border: "none",
                  borderRadius: "var(--radius-pill)",
                  padding: "12px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  cursor: "pointer"
                }}
              >
                {aiLoading ? "Consulting store logs..." : "✦ ASK AI"}
              </button>
            </div>

            {aiResponse && (
              <div style={{
                marginTop: "20px",
                padding: "14px",
                background: "#fff",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                fontSize: "13px",
                lineHeight: "1.5"
              }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--teal)", textTransform: "uppercase", marginBottom: "6px", fontWeight: "bold" }}>
                  AI Response
                </div>
                <p style={{ margin: 0, color: "var(--ink)" }}>{aiResponse}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Page Head */}
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <span className="dot"></span> WORKSPACE OVERVIEW
          </div>
          <h1 className="display">{greeting}</h1>
        </div>
        <div className="live-pill">
          <span className="pulse"></span> 24 visitors active right now
        </div>
      </div>

      {/* KPI STRIP */}
      <div className="kpi-strip">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="kpi-card">
            <div className="kpi-label">{kpi.label}</div>
            <div className="kpi-value mono">{kpi.value}</div>
            <div className={`kpi-delta ${kpi.type}`}>
              {kpi.delta}
            </div>
          </div>
        ))}
      </div>

      {/* Two Column Section */}
      <div className="grid-2">
        {/* Live Activity Feed */}
        <div className="card">
          <div className="card-head">
            <h3>Live Activity</h3>
            <Link href="/dashboard/conversations" className="view-all">
              View all →
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {activities.map((activity) => (
              <div key={activity.id} className="feed-item" style={{ cursor: "pointer" }} onClick={() => router.push("/dashboard/conversations")}>
                <div className={`feed-dot ${activity.color}`}></div>
                <div>
                  <div className="feed-text">
                    {renderActivityText(activity.name, activity.text)}
                  </div>
                  <div className="feed-time">{activity.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Actionable Insights */}
        <div className="card">
          <div className="card-head">
            <h3>AI Insights</h3>
            <span className="view-all" style={{ cursor: "pointer" }} onClick={() => router.push("/dashboard/analytics")}>View all →</span>
          </div>

          <div>
            {insights.map((insight, idx) => (
              <div key={idx} className="insight">
                <div className="insight-tag">{insight.tag}</div>
                <p>{insight.text}</p>
                <button className="insight-action" onClick={() => handleInsightAction(insight.action)}>{insight.action}</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid 3 Widgets */}
      <div className="grid-3">
        {/* Revenue 7 Days */}
        <div className="card">
          <div className="card-head">
            <h3>Revenue, 7 Days</h3>
          </div>
          <div className="bars">
            {barChartHeights.map((h, idx) => (
              <div 
                key={idx} 
                className={`bar ${h === 100 ? "peak" : ""}`} 
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="bar-labels">
            <span>MON</span>
            <span>TUE</span>
            <span>WED</span>
            <span>THU</span>
            <span>FRI</span>
            <span>SAT</span>
            <span>SUN</span>
          </div>
        </div>

        {/* Conversation Funnel */}
        <div className="card">
          <div className="card-head">
            <h3>Conversation Funnel</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "6px" }}>
            {funnelStages.map((stage, idx) => (
              <div key={idx} className="funnel-row">
                <div className="funnel-label">{stage.label}</div>
                <div className="funnel-bar-track">
                  <div
                    className={`funnel-bar-fill ${stage.isHighlight ? "final" : ""}`}
                    style={{ width: stage.fillWidth }}
                  />
                </div>
                <div className="funnel-pct mono">{stage.pct}</div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Health Score Ring */}
        <div className="card">
          <div className="card-head">
            <h3>AI Health Score</h3>
          </div>
          <div className="health-wrap">
            <svg className="health-ring" viewBox="0 0 84 84">
              <circle cx="42" cy="42" r="36" fill="none" stroke="var(--line)" strokeWidth="8"/>
              <circle cx="42" cy="42" r="36" fill="none" stroke="var(--teal)" strokeWidth="8"
                strokeDasharray="226" strokeDashoffset="5" strokeLinecap="round"
                transform="rotate(-90 42 42)"/>
            </svg>
            <div className="health-text">
              <div className="h-num mono">98%</div>
              <div className="h-label">Response time, accuracy<br/>& resolution nominal</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Row */}
      <div className="card">
        <div className="card-head">
          <h3>Quick Actions</h3>
        </div>
        <div className="quick-actions">
          {[
            {
              label: "Add product",
              action: "Add Product",
              icon: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
            },
            {
              label: "Import catalog",
              action: "Import Catalog",
              icon: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
            },
            {
              label: "Launch automation",
              action: "Launch Automation",
              icon: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
            },
            {
              label: "Broadcast campaign",
              action: "Broadcast Campaign",
              icon: <><path d="M4 4h16v12H7l-3 3z" /></>,
            },
            {
              label: "Invite team member",
              action: "Invite Team Member",
              icon: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></>,
            },
            {
              label: "Connect integration",
              action: "Connect Integration",
              icon: <><path d="M18 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" /><path d="M6 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" /><path d="M8.6 16.4 15.4 7.6" /></>,
            },
          ].map((qa) => (
            <button key={qa.action} className="qa-btn" onClick={() => handleQuickAction(qa.action)}>
              <span className="qa-ico">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  {qa.icon}
                </svg>
              </span>
              <span className="qa-label">{qa.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
