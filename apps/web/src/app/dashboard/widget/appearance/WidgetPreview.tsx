"use client";

import React, { useState } from "react";
import type { ResolvedWidgetTheme } from "@/server/branding/types";

interface WidgetPreviewProps {
  theme: ResolvedWidgetTheme;
}

export default function WidgetPreview({ theme }: WidgetPreviewProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Derive inline CSS variables for the sandboxed preview container
  const previewStyle: React.CSSProperties = {
    // Custom CSS Variables for preview
    ["--mv-primary" as any]: theme.primary || "#0F62FE",
    ["--mv-on-primary" as any]: theme.onPrimary || "#ffffff",
    ["--mv-header" as any]: theme.header || theme.primary || "#0F62FE",
    ["--mv-launcher" as any]: theme.launcher || theme.primary || "#0F62FE",
    ["--mv-user-bubble" as any]: theme.userBubble || theme.primary || "#0F62FE",
    ["--mv-ai-bubble" as any]: theme.assistantBubble || "#ffffff",
    ["--mv-background" as any]: theme.background || "#F8FAFC",
    ["--mv-quick-reply" as any]: theme.quickReply || "#EFF6FF",
    ["--mv-border" as any]: theme.border || "#E2E8F0",
    ["--mv-font-family" as any]: theme.fontFamily || "Inter, sans-serif",
    ["--mv-radius" as any]: theme.borderRadius || "16px",
    fontFamily: theme.fontFamily || "Inter, sans-serif",
  };

  // Launcher style variants
  const getLauncherStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      width: theme.launcherSize || 56,
      height: theme.launcherSize || 56,
      backgroundColor: "var(--mv-launcher)",
      color: "var(--mv-on-primary)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
      transition: "all 0.2s ease",
      border: "none",
    };

    switch (theme.launcherStyle) {
      case "ROUNDED":
        return { ...base, borderRadius: "14px" };
      case "SQUARE":
        return { ...base, borderRadius: "4px" };
      case "GLASS":
        return {
          ...base,
          backgroundColor: "rgba(15, 98, 254, 0.75)",
          backdropFilter: "blur(8px)",
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.3)",
        };
      case "MINIMAL":
        return { ...base, borderRadius: "50%", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" };
      case "CIRCLE":
      default:
        return { ...base, borderRadius: "50%" };
    }
  };

  return (
    <div className="wg-preview-sandbox" style={previewStyle}>
      <div className="wg-preview-browser-bar">
        <span className="dot red"></span>
        <span className="dot yellow"></span>
        <span className="dot green"></span>
        <span className="url-bar">{theme.businessName || "merchant-site.com"}</span>
      </div>

      <div className="wg-preview-canvas">
        {/* Mock background content representing merchant's store */}
        <div className="wg-mock-page">
          <div className="wg-mock-nav">
            <div className="wg-mock-brand">
              {theme.logoUrl ? (
                <img src={theme.logoUrl} alt="Logo" className="wg-preview-logo" />
              ) : (
                <div className="wg-mock-logo-box">{theme.businessName[0] || "M"}</div>
              )}
              <span>{theme.businessName || "Store"}</span>
            </div>
            <div className="wg-mock-links">
              <span>Shop</span>
              <span>About</span>
              <span>Contact</span>
            </div>
          </div>
          <div className="wg-mock-hero">
            <h3>Automated Store Experience</h3>
            <p>Your AI Sales Assistant is configured and ready to convert visitors.</p>
          </div>
        </div>

        {/* Live Widget Preview */}
        <div className={`wg-preview-widget-position position-${theme.position.toLowerCase()}`}>
          {isOpen && (
            <div className={`wg-preview-chat-window animation-${theme.animation.toLowerCase()}`}>
              {/* Header */}
              <div
                className="wg-preview-header"
                style={{ height: theme.headerHeight || 64, backgroundColor: "var(--mv-header)", color: "var(--mv-on-primary)" }}
              >
                <div className="wg-preview-header-info">
                  {theme.logoUrl ? (
                    <img src={theme.logoUrl} alt="Logo" className="wg-header-avatar" />
                  ) : (
                    <div className="wg-header-avatar-fallback">
                      {(theme.assistantName || "AI")[0]}
                    </div>
                  )}
                  <div>
                    <div className="wg-assistant-title">{theme.assistantName || "Lumi"}</div>
                    <div className="wg-assistant-status">Online • Instant Support</div>
                  </div>
                </div>
                <button className="wg-preview-close" onClick={() => setIsOpen(false)}>
                  ✕
                </button>
              </div>

              {/* Chat Body */}
              <div className="wg-preview-body" style={{ backgroundColor: "var(--mv-background)" }}>
                {/* AI Row */}
                <div className="wg-preview-msg ai">
                  {theme.logoUrl ? (
                    <img src={theme.logoUrl} alt="AI Avatar" className="wg-preview-avatar" />
                  ) : (
                    <div
                      className="wg-preview-avatar"
                      style={{
                        backgroundColor: "var(--mv-primary)",
                        color: "var(--mv-on-primary)",
                        display: "flex",
                        alignItems: "center",
                        justify-content: "center",
                        fontWeight: "bold",
                        fontSize: 13,
                      }}
                    >
                      {(theme.assistantName || "A")[0]}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div
                      className="wg-bubble ai"
                      style={{
                        backgroundColor: "var(--mv-ai-bubble)",
                        borderColor: "var(--mv-border)",
                      }}
                    >
                      Welcome to {theme.businessName || "our store"}! How can I help you find what you need today?
                    </div>
                    <div className="wg-msg-time">2:40 PM</div>
                  </div>
                </div>

                {/* User Row */}
                <div className="wg-preview-msg user">
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <div
                      className="wg-bubble user"
                      style={{
                        backgroundColor: "var(--mv-user-bubble)",
                        color: "var(--mv-on-primary)",
                      }}
                    >
                      I'm looking for recommendations.
                    </div>
                    <div className="wg-msg-time">2:41 PM</div>
                  </div>
                </div>

                {/* Quick replies */}
                <div className="wg-preview-chips">
                  <span
                    className="wg-chip"
                    style={{
                      backgroundColor: "var(--mv-quick-reply)",
                      borderColor: "var(--mv-border)",
                    }}
                  >
                    🔍 Best sellers
                  </span>
                  <span
                    className="wg-chip"
                    style={{
                      backgroundColor: "var(--mv-quick-reply)",
                      borderColor: "var(--mv-border)",
                    }}
                  >
                    🚚 Shipping info
                  </span>
                </div>
              </div>

              {/* Input Bar */}
              <div className="wg-preview-input-bar" style={{ borderColor: "var(--mv-border)" }}>
                <span style={{ fontSize: 18, opacity: 0.6, cursor: "pointer" }}>😊</span>
                <input type="text" placeholder="Ask anything..." disabled />
                <button style={{ backgroundColor: "var(--mv-primary)", color: "var(--mv-on-primary)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Launcher Button */}
          <button style={getLauncherStyle()} onClick={() => setIsOpen(!isOpen)} title="Toggle Preview Widget">
            {isOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
