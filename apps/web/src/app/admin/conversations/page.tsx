"use client";
import React, { useEffect, useState } from "react";

interface Message {
  role: "customer" | "ai" | "system";
  content: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  merchant: string;
  customerName: string;
  customerEmail: string;
  intent: string;
  confidence: number;
  stage: string;
  productsUsed: string[];
  retrievedDocs: string[];
  tokensUsed: number;
  latency: number;
  status: "active" | "handed_off" | "resolved";
  messages: Message[];
  createdAt: string;
}

export default function AdminConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "handed_off" | "resolved">("all");

  useEffect(() => {
    fetch("/api/admin/conversations")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.conversations) setConversations(d.conversations);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? conversations : conversations.filter((c) => c.status === filter);

  return (
    <div style={{ display: "flex", gap: 0, height: "calc(100vh - 48px - 48px)", margin: -24 }}>
      {/* Conversation list */}
      <div style={{ width: 380, flexShrink: 0, borderRight: "1px solid var(--admin-border)", display: "flex", flexDirection: "column", background: "var(--admin-bg-raised)" }}>
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--admin-border)" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>Live Conversations</h2>
          <div style={{ display: "flex", gap: 4 }}>
            {(["all", "active", "handed_off", "resolved"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{
                fontFamily: "var(--admin-mono)", fontSize: 10, padding: "4px 10px", borderRadius: 999,
                border: "1px solid", cursor: "pointer", background: filter === f ? "var(--admin-primary)" : "transparent",
                borderColor: filter === f ? "var(--admin-primary)" : "var(--admin-border)",
                color: filter === f ? "#fff" : "var(--admin-text-soft)", transition: "all 0.1s",
              }}>{f === "all" ? "All" : f.replace("_", " ")}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--admin-text-muted)" }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--admin-text-muted)" }}>No conversations found.</div>
          ) : (
            filtered.map((c) => (
              <div key={c.id} onClick={() => setSelected(c)} style={{
                padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid var(--admin-border)",
                background: selected?.id === c.id ? "var(--admin-bg-active)" : "transparent",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{c.customerName}</span>
                  <span style={{ fontFamily: "var(--admin-mono)", fontSize: 11, color: "var(--admin-text-muted)" }}>{c.createdAt}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--admin-text-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>
                  {c.messages[c.messages.length - 1]?.content || "No messages"}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%", display: "inline-block",
                    background: c.status === "active" ? "var(--admin-green)" : c.status === "handed_off" ? "var(--admin-yellow)" : "var(--admin-text-muted)",
                  }} />
                  <span style={{ fontFamily: "var(--admin-mono)", fontSize: 10, color: "var(--admin-text-soft)" }}>{c.merchant}</span>
                  <span style={{ fontFamily: "var(--admin-mono)", fontSize: 10, color: "var(--admin-primary)" }}>{c.intent}</span>
                  <span style={{ fontFamily: "var(--admin-mono)", fontSize: 10, color: "var(--admin-text-muted)" }}>{c.confidence}%</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Conversation detail */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--admin-bg)" }}>
        {!selected ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--admin-text-muted)" }}>
            Select a conversation to view details
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--admin-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{selected.customerName}</div>
                <div style={{ fontFamily: "var(--admin-mono)", fontSize: 11, color: "var(--admin-text-soft)" }}>{selected.customerEmail} · {selected.merchant}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="admin-login-btn" style={{ padding: "6px 12px", fontSize: 11, background: "transparent", border: "1px solid var(--admin-border)", color: "var(--admin-text)" }}>Pause</button>
                <button className="admin-login-btn" style={{ padding: "6px 12px", fontSize: 11, background: "var(--admin-yellow-tint)", border: "1px solid rgba(234,179,8,0.2)", color: "var(--admin-yellow)" }}>Take Over</button>
                <button className="admin-login-btn" style={{ padding: "6px 12px", fontSize: 11, background: "var(--admin-red-tint)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--admin-red)" }}>Terminate</button>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {selected.messages.map((msg, i) => (
                <div key={i} style={{
                  display: "flex", gap: 10, marginBottom: 16,
                  flexDirection: msg.role === "customer" ? "row" : "row-reverse",
                }}>
                  <div style={{
                    maxWidth: "70%", padding: "10px 14px", borderRadius: "var(--admin-radius-md)",
                    background: msg.role === "customer" ? "var(--admin-bg-card)" : "var(--admin-primary-tint)",
                    border: "1px solid", borderColor: msg.role === "customer" ? "var(--admin-border)" : "rgba(59,130,246,0.15)",
                  }}>
                    <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 4 }}>{msg.content}</div>
                    <div style={{ fontFamily: "var(--admin-mono)", fontSize: 10, color: "var(--admin-text-muted)", textAlign: msg.role === "customer" ? "left" : "right" }}>
                      {msg.role === "ai" ? "AI" : msg.role === "system" ? "System" : "Customer"} · {msg.timestamp}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* AI Pipeline Panel */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--admin-border)", background: "var(--admin-bg-raised)" }}>
              <div className="admin-grid-3" style={{ gap: 8 }}>
                <div>
                  <div style={{ fontFamily: "var(--admin-mono)", fontSize: 9, color: "var(--admin-text-muted)", textTransform: "uppercase" }}>Confidence</div>
                  <div style={{ fontFamily: "var(--admin-mono)", fontSize: 13, fontWeight: 600 }}>{selected.confidence}%</div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--admin-mono)", fontSize: 9, color: "var(--admin-text-muted)", textTransform: "uppercase" }}>Latency</div>
                  <div style={{ fontFamily: "var(--admin-mono)", fontSize: 13, fontWeight: 600 }}>{selected.latency}s</div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--admin-mono)", fontSize: 9, color: "var(--admin-text-muted)", textTransform: "uppercase" }}>Tokens</div>
                  <div style={{ fontFamily: "var(--admin-mono)", fontSize: 13, fontWeight: 600 }}>{selected.tokensUsed.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--admin-mono)", fontSize: 9, color: "var(--admin-text-muted)", textTransform: "uppercase" }}>Intent</div>
                  <div style={{ fontSize: 13 }}>{selected.intent}</div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--admin-mono)", fontSize: 9, color: "var(--admin-text-muted)", textTransform: "uppercase" }}>Products</div>
                  <div style={{ fontSize: 13 }}>{selected.productsUsed.join(", ") || "None"}</div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--admin-mono)", fontSize: 9, color: "var(--admin-text-muted)", textTransform: "uppercase" }}>Docs Retrieved</div>
                  <div style={{ fontSize: 13 }}>{selected.retrievedDocs.join(", ") || "None"}</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
