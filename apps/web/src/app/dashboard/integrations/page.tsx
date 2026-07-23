"use client";

import React, { useEffect, useState } from "react";
import "./integrations.css";

interface Integration {
  id: string;
  channel: string;
  status: string;
  label: string;
  desc: string;
  icon: string;
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([
    { id: "website", channel: "WEBSITE", status: "CONNECTED", label: "Website Widget", desc: "Your embedded AI widget", icon: "globe" },
    { id: "whatsapp", channel: "WHATSAPP", status: "PENDING", label: "WhatsApp", desc: "Connect your WhatsApp Business number for AI sales", icon: "message-circle" },
    { id: "instagram", channel: "INSTAGRAM", status: "DISABLED", label: "Instagram", desc: "Handle DMs and comments with AI", icon: "camera" },
    { id: "facebook", channel: "FACEBOOK", status: "DISABLED", label: "Facebook Messenger", desc: "Automate responses on your Facebook page", icon: "message-square" },
    { id: "email", channel: "EMAIL", status: "PENDING", label: "Email", desc: "AI-powered email follow-ups", icon: "mail" },
  ]);

  useEffect(() => {
    fetch("/api/integrations")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.integrations) && data.integrations.length > 0) {
          setIntegrations(data.integrations);
        }
      })
      .catch(() => {});
  }, []);

  const statusColor = (status: string) => {
    switch (status) {
      case "CONNECTED": return "var(--teal)";
      case "PENDING": return "#c8860d";
      case "ERROR": return "#b23a2e";
      default: return "var(--ink-soft)";
    }
  };

  const handleConnect = async (channel: string) => {
    try {
      const res = await fetch("/api/integrations/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      if (res.ok) {
        setIntegrations((prev) =>
          prev.map((i) =>
            i.channel === channel ? { ...i, status: "CONNECTED" } : i
          )
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDisconnect = async (channel: string) => {
    try {
      const res = await fetch("/api/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      if (res.ok) {
        setIntegrations((prev) =>
          prev.map((i) =>
            i.channel === channel ? { ...i, status: "DISABLED" } : i
          )
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="in-page-head">
        <div className="eyebrow"><span className="dot"></span> INTELLIGENCE</div>
        <h1>Integrations</h1>
        <p className="in-subtitle">Connect your sales channels to let the AI agent engage customers everywhere you sell.</p>
      </div>

      <div className="in-grid">
        {integrations.map((int) => (
          <div key={int.id} className={`in-card ${int.status === "CONNECTED" ? "connected" : ""}`}>
            <div className="in-card-top">
              <div className="in-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {int.icon === "globe" && <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>}
                  {int.icon === "message-circle" && <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>}
                  {int.icon === "camera" && <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>}
                  {int.icon === "message-square" && <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>}
                  {int.icon === "mail" && <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>}
                </svg>
              </div>
              <div>
                <div className="in-name">{int.label}</div>
                <div className="in-desc">{int.desc}</div>
              </div>
            </div>
            <div className="in-status-row">
              <span className="in-status-dot" style={{ background: statusColor(int.status) }}></span>
              <span className="in-status-label">{int.status === "CONNECTED" ? "Connected" : int.status === "PENDING" ? "Pending setup" : int.status === "ERROR" ? "Error" : "Not connected"}</span>
            </div>
            <div className="in-card-actions">
              {int.status === "CONNECTED" ? (
                <button className="btn-ghost" onClick={() => handleDisconnect(int.channel)}>Disconnect</button>
              ) : int.status === "PENDING" ? (
                <button className="btn-dark" style={{ width: "100%" }} onClick={() => handleConnect(int.channel)}>Complete setup</button>
              ) : (
                <button className="btn-dark" style={{ width: "100%" }} onClick={() => handleConnect(int.channel)}>Connect</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="in-note">
        <strong>Note:</strong> Only the Website Widget channel is active currently. WhatsApp, Instagram, Facebook Messenger, and Email are not yet implemented — clicking Connect will attempt the API call but may not complete setup until those integrations are built.
      </div>
    </div>
  );
}
