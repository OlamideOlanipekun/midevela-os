"use client";

import React, { useEffect, useState } from "react";
import "./conversations.css";

interface Message {
  role: "customer" | "ai";
  content: string;
  createdAt: string;
  recommendations?: Array<{
    name: string;
    price: string;
    why: string;
  }>;
}

interface Conversation {
  id: string;
  name: string;
  email: string;
  stage: string;
  badgeClass: string;
  unread: boolean;
  time: string;
  preview: string;
  aiConfidence: number;
  preferences: string[];
  viewedProducts: string[];
  messages: Message[];
}

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [inputText, setInputText] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  useEffect(() => {
    fetch("/api/conversations")
      .then((res) => res.json())
      .then((data) => {
        const list: Conversation[] = Array.isArray(data.conversations) ? data.conversations : [];
        setConversations(list);
        if (list.length > 0) setActiveId(list[0].id);
      })
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  }, []);

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;
  const unreadCount = conversations.filter((c) => c.unread).length;

  const visibleConversations = conversations
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .filter((c) => filter === "all" || c.unread);

  // Human reply is not yet implemented — all conversations are AI-handled.
  // The input remains disabled until direct merchant reply is built.

  return (
    <div className="conv-page">
      {/* Page head */}
      <div className="conv-page-head">
        <div>
          <div className="eyebrow">
            <span className="dot"></span> COUNTER FLOOR
          </div>
          <h1>Conversations</h1>
        </div>
        <div className="live-pill">
          <span className="pulse"></span> {conversations.length} at the counter · {unreadCount} unread
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--ink-soft)" }}>Loading conversations…</div>
      ) : conversations.length === 0 || !activeConv ? (
        <div className="card" style={{ padding: 60, textAlign: "center", color: "var(--ink-soft)" }}>
          No conversations yet. Once visitors start chatting through your widget, they&apos;ll show up here.
        </div>
      ) : (
      <div className="conv-layout">
        {/* LEFT: QUEUE */}
        <div className={`conv-panel conv-list-panel ${mobileView === "chat" ? "conv-list-panel-hidden" : ""}`}>
          <div className="conv-list-header">
            <div className="conv-list-title">
              <h2>Queue</h2>
              <span className="conv-list-count">{visibleConversations.length} shown</span>
            </div>
            <div className="conv-list-search">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search the queue…"
                className="conv-list-search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="tabs" role="tablist">
              <button
                role="tab"
                aria-selected={filter === "all"}
                className={`tab ${filter === "all" ? "tab-active" : ""}`}
                onClick={() => setFilter("all")}
              >
                All
              </button>
              <button
                role="tab"
                aria-selected={filter === "unread"}
                className={`tab ${filter === "unread" ? "tab-active" : ""}`}
                onClick={() => setFilter("unread")}
              >
                Unread
              </button>
            </div>
          </div>

          <div className="conv-list-scroll">
            {visibleConversations.map((c) => (
              <div
                role="button"
                tabIndex={0}
                key={c.id}
                className={`conv-item ${c.id === activeId ? "active" : ""}`}
                onClick={() => { setActiveId(c.id); setMobileView("chat"); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveId(c.id);
                    setMobileView("chat");
                  }
                }}
              >
                <div className="conv-item-avatar">
                  <div className="conv-avatar">{c.name[0]}</div>
                  {c.unread && <span className="conv-item-unread" />}
                </div>
                <div className="conv-item-body">
                  <div className="conv-item-top">
                    <span className="conv-item-name">{c.name}</span>
                    <span className="conv-item-time">{c.time}</span>
                  </div>
                  <span className="conv-item-preview">{c.preview}</span>
                  <div className="conv-item-bottom">
                    <span className={`badge ${c.badgeClass}`}>{c.stage}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER: CONVERSATION */}
        <div className={`conv-panel conv-chat-panel ${mobileView === "list" ? "conv-chat-panel-hidden" : ""}`}>
          <div className="conv-chat-header">
            <div className="conv-chat-header-info">
              <button
                className="conv-back-btn"
                onClick={() => setMobileView("list")}
                aria-label="Back to conversations"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <div className="conv-avatar" style={{ width: 40, height: 40, fontSize: 15 }}>
                {activeConv.name[0]}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="conv-chat-title">{activeConv.name}</div>
                <div className="conv-chat-sub">
                  <span className="conv-live-dot" aria-hidden="true"></span>
                  <span className={`badge ${activeConv.badgeClass}`}>{activeConv.stage}</span>
                </div>
              </div>
            </div>
            <button className="conv-takeover-btn" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>
              Manual reply — coming soon
            </button>
          </div>

          <div className="conv-chat-scroll">
            {activeConv.messages.map((msg, i) => (
              <div key={i} className={`conv-msg-group ${msg.role}`}>
                <div className="conv-msg-bubble">{msg.content}</div>

                {msg.recommendations && (
                  <div className="conv-recos-container">
                    {msg.recommendations.map((reco, j) => (
                      <div key={j} className="conv-reco-card">
                        <span className="conv-reco-name">{reco.name}</span>
                        <span className="conv-reco-price">{reco.price}</span>
                        <span className="conv-reco-why">{reco.why}</span>
                        <span className="conv-reco-btn">View product →</span>
                      </div>
                    ))}
                  </div>
                )}

                <span className="conv-msg-meta">
                  {msg.role === "ai" ? (
                    <>
                      <span>Midevela AI · {formatMessageTime(msg.createdAt)}</span>
                      <span className="ticks">✓✓</span>
                    </>
                  ) : (
                    <span>{formatMessageTime(msg.createdAt)}</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          <div className="conv-chat-input-area">
            <input
              type="text"
              placeholder="AI handles conversations — human reply coming soon"
              className="conv-chat-input"
              disabled
              style={{ opacity: 0.5, cursor: "not-allowed" }}
            />
            <button className="conv-send-btn" disabled style={{ opacity: 0.4, cursor: "not-allowed" }}>
              Send →
            </button>
          </div>
        </div>

        {/* RIGHT: CUSTOMER FILE */}
        <div className="conv-panel conv-profile-panel">
          <div className="conv-profile-header">
            <div className="conv-profile-avatar">{activeConv.name[0]}</div>
            <div style={{ minWidth: 0 }}>
              <div className="conv-profile-name">{activeConv.name}</div>
              <div className="conv-profile-email">{activeConv.email}</div>
            </div>
          </div>

          <div className="conv-profile-section">
            <span className="conv-profile-label">AI Confidence</span>
            <div className="conv-conf-row">
              <span className="conv-conf-value">{activeConv.aiConfidence}%</span>
              <span className="conv-conf-note">
                {activeConv.aiConfidence >= 90
                  ? "Handling well"
                  : activeConv.aiConfidence >= 80
                  ? "Steady"
                  : "May need you"}
              </span>
            </div>
            <div className="conv-conf-track" role="meter" aria-valuenow={activeConv.aiConfidence} aria-valuemin={0} aria-valuemax={100} aria-label="AI confidence">
              <div
                className="conv-conf-fill"
                style={{ width: `${activeConv.aiConfidence}%` }}
              />
            </div>
          </div>

          <div className="conv-profile-section">
            <span className="conv-profile-label">Preferences learned</span>
            <div className="conv-profile-pills">
              {activeConv.preferences.length > 0 ? (
                activeConv.preferences.map((p) => (
                  <span key={p} className="conv-profile-pill">
                    {p}
                  </span>
                ))
              ) : (
                <span style={{ color: "var(--ink-soft)", fontSize: 13 }}>Nothing learned yet.</span>
              )}
            </div>
          </div>

          <div className="conv-profile-section">
            <span className="conv-profile-label">Viewed products</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {activeConv.viewedProducts.length > 0 ? (
                activeConv.viewedProducts.map((p) => (
                  <div key={p} className="conv-viewed-item">
                    <span className="conv-viewed-thumb">{p[0]}</span>
                    <span className="conv-viewed-name">{p}</span>
                  </div>
                ))
              ) : (
                <span style={{ color: "var(--ink-soft)", fontSize: 13 }}>No product views tracked yet.</span>
              )}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
