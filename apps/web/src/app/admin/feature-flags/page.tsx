"use client";
import React, { useState } from "react";

interface Flag {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  global: boolean;
}

const defaultFlags: Flag[] = [
  { key: "ai_memory_v2", label: "AI Memory v2", description: "Long-term memory across sessions", enabled: false, global: false },
  { key: "vision", label: "Vision", description: "Image recognition in conversations", enabled: false, global: false },
  { key: "voice", label: "Voice", description: "Voice input/output support", enabled: false, global: false },
  { key: "video", label: "Video", description: "Video product demos in recommendations", enabled: false, global: false },
  { key: "recommendations_v2", label: "Recommendations v2", description: "New recommendation engine with reranking", enabled: true, global: true },
  { key: "whatsapp_channel", label: "WhatsApp Channel", description: "WhatsApp Business integration", enabled: true, global: false },
  { key: "instagram_channel", label: "Instagram Channel", description: "Instagram DM integration", enabled: false, global: false },
  { key: "analytics_v2", label: "Analytics v2", description: "Enhanced analytics dashboard", enabled: false, global: false },
];

export default function AdminFeatureFlags() {
  const [flags, setFlags] = useState<Flag[]>(defaultFlags);

  const toggle = (key: string) => {
    setFlags((prev) => prev.map((f) => f.key === key ? { ...f, enabled: !f.enabled } : f));
  };

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>Feature Flags</h1>
          <p>Enable or disable platform features globally or per-merchant.</p>
        </div>
        <button className="admin-login-btn" style={{ padding: "8px 16px", fontSize: 11 }}>+ New Flag</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {flags.map((flag) => (
          <div key={flag.key} className="admin-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px" }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{flag.label}</div>
              <div style={{ fontSize: 12, color: "var(--admin-text-soft)" }}>{flag.description}</div>
              <div style={{ fontFamily: "var(--admin-mono)", fontSize: 10, color: "var(--admin-text-muted)", marginTop: 2 }}>{flag.key}{flag.global ? " · Global" : ""}</div>
            </div>
            <button onClick={() => toggle(flag.key)} style={{
              width: 40, height: 22, borderRadius: 999, border: "none", cursor: "pointer", position: "relative",
              background: flag.enabled ? "var(--admin-primary)" : "var(--admin-border)", transition: "background 0.15s",
            }}>
              <span style={{
                position: "absolute", top: 2, width: 18, height: 18, borderRadius: "50%",
                background: "#fff", transition: "left 0.15s",
                left: flag.enabled ? 20 : 2,
              }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
