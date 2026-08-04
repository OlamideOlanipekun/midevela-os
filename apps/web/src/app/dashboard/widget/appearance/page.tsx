"use client";

import React, { useEffect, useState } from "react";
import { useSubscription } from "@/components/providers/SubscriptionProvider";
import WidgetPreview from "./WidgetPreview";
import type { ResolvedWidgetTheme } from "@/server/branding/types";
import { LauncherStyle, WidgetAnimation, WidgetPosition } from "@prisma/client";
import "./appearance.css";

const FONT_OPTIONS = [
  "Inter",
  "Poppins",
  "Roboto",
  "Open Sans",
  "Montserrat",
  "Playfair Display",
  "System-ui",
];

const RADIUS_OPTIONS = [
  { label: "Square (0px)", value: "0px" },
  { label: "Slightly Rounded (6px)", value: "6px" },
  { label: "Rounded (16px)", value: "16px" },
  { label: "Pill (9999px)", value: "9999px" },
];

export default function WidgetAppearancePage() {
  const { isReadOnly } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [redetecting, setRedetecting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Customizer state
  const [theme, setTheme] = useState<ResolvedWidgetTheme>({
    primary: "#0F62FE",
    secondary: "#EAF2FF",
    accent: "#0F62FE",
    header: "#0F62FE",
    launcher: "#0F62FE",
    userBubble: "#0F62FE",
    assistantBubble: "#FFFFFF",
    background: "#F8FAFC",
    quickReply: "#EFF6FF",
    border: "#E5E7EB",
    fontFamily: "Inter",
    borderRadius: "16px",
    onPrimary: "#FFFFFF",
    logoUrl: null,
    faviconUrl: null,
    businessName: "My Store",
    assistantName: "Lumi",
    launcherStyle: LauncherStyle.CIRCLE,
    position: WidgetPosition.BOTTOM_RIGHT,
    animation: WidgetAnimation.FADE,
    launcherSize: 56,
    headerHeight: 64,
    isAutoDetected: true,
  });

  useEffect(() => {
    fetchTheme();
  }, []);

  const fetchTheme = async () => {
    try {
      const res = await fetch("/api/theme");
      const data = await res.json();
      if (data.theme) {
        setTheme(data.theme);
      }
    } catch (err) {
      console.error("Failed to load theme:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryColor: theme.primary,
          secondaryColor: theme.secondary,
          accentColor: theme.accent,
          headerColor: theme.header,
          launcherColor: theme.launcher,
          userBubbleColor: theme.userBubble,
          assistantBubbleColor: theme.assistantBubble,
          backgroundColor: theme.background,
          borderStyle: theme.border,
          fontFamily: theme.fontFamily,
          borderRadius: theme.borderRadius,
          businessName: theme.businessName,
          assistantName: theme.assistantName,
          logoUrl: theme.logoUrl || undefined,
          launcherStyle: theme.launcherStyle,
          position: theme.position,
          animation: theme.animation,
          launcherSize: theme.launcherSize,
          headerHeight: theme.headerHeight,
        }),
      });

      if (res.ok) {
        setToast("Appearance settings saved.");
        setTimeout(() => setToast(null), 3000);
        await fetchTheme();
      }
    } catch (err) {
      console.error("Failed to save theme:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRedetect = async () => {
    setRedetecting(true);
    try {
      const res = await fetch("/api/theme/redetect", { method: "POST" });
      if (res.ok) {
        setToast("Re-detected brand styling from website.");
        setTimeout(() => setToast(null), 3000);
        await fetchTheme();
      }
    } catch (err) {
      console.error("Failed to redetect theme:", err);
    } finally {
      setRedetecting(false);
    }
  };

  if (loading) {
    return <div className="mono" style={{ padding: 32 }}>Loading widget appearance...</div>;
  }

  return (
    <div>
      <div className="wg-page-head">
        <div className="eyebrow"><span className="dot"></span> APPEARANCE</div>
        <h1>Widget Appearance</h1>
        <p className="wg-subtitle">
          Customize your AI sales widget to match your store's brand colors, fonts, and style.
        </p>
      </div>

      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          {theme.isAutoDetected ? (
            <span className="wg-auto-badge">✨ Auto-detected from your website</span>
          ) : (
            <span className="wg-auto-badge" style={{ background: "rgba(15, 98, 254, 0.1)", color: "#0F62FE" }}>
              ✏️ Manually customized
            </span>
          )}
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={handleRedetect}
          disabled={redetecting || isReadOnly}
          style={{ fontSize: 12 }}
        >
          {redetecting ? "Re-detecting..." : "🔄 Re-detect from website"}
        </button>
      </div>

      <div className="wg-customizer-grid">
        {/* Controls Column */}
        <form onSubmit={handleSave} className="wg-controls-column">
          <fieldset disabled={isReadOnly} style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* Branding Section */}
            <section className="wg-section">
              <h2>Branding</h2>
              <div className="wg-field">
                <label>Business Name</label>
                <input
                  type="text"
                  value={theme.businessName || ""}
                  onChange={(e) => setTheme({ ...theme, businessName: e.target.value })}
                  placeholder="e.g. Lumina Beauty"
                  className="wg-select"
                />
              </div>
              <div className="wg-field">
                <label>Assistant Name</label>
                <input
                  type="text"
                  value={theme.assistantName || ""}
                  onChange={(e) => setTheme({ ...theme, assistantName: e.target.value })}
                  placeholder="e.g. Lumi"
                  className="wg-select"
                />
              </div>
              <div className="wg-field">
                <label>Logo URL</label>
                <input
                  type="text"
                  value={theme.logoUrl || ""}
                  onChange={(e) => setTheme({ ...theme, logoUrl: e.target.value })}
                  placeholder="https://yourstore.com/logo.png"
                  className="wg-select"
                />
                <p className="wg-hint">Leave blank to use initial or auto-detected logo.</p>
              </div>
            </section>

            {/* Colors Section */}
            <section className="wg-section">
              <h2>Colors</h2>
              <div className="wg-color-grid">
                <div className="wg-color-card">
                  <label>Header</label>
                  <div className="wg-color-row">
                    <input
                      type="color"
                      className="wg-color-input"
                      value={theme.header || "#0F62FE"}
                      onChange={(e) => setTheme({ ...theme, header: e.target.value, primary: e.target.value })}
                    />
                    <span className="wg-color-hex">{theme.header}</span>
                  </div>
                </div>

                <div className="wg-color-card">
                  <label>Launcher</label>
                  <div className="wg-color-row">
                    <input
                      type="color"
                      className="wg-color-input"
                      value={theme.launcher || "#0F62FE"}
                      onChange={(e) => setTheme({ ...theme, launcher: e.target.value })}
                    />
                    <span className="wg-color-hex">{theme.launcher}</span>
                  </div>
                </div>

                <div className="wg-color-card">
                  <label>User Bubble</label>
                  <div className="wg-color-row">
                    <input
                      type="color"
                      className="wg-color-input"
                      value={theme.userBubble || "#0F62FE"}
                      onChange={(e) => setTheme({ ...theme, userBubble: e.target.value })}
                    />
                    <span className="wg-color-hex">{theme.userBubble}</span>
                  </div>
                </div>

                <div className="wg-color-card">
                  <label>AI Bubble</label>
                  <div className="wg-color-row">
                    <input
                      type="color"
                      className="wg-color-input"
                      value={theme.assistantBubble || "#FFFFFF"}
                      onChange={(e) => setTheme({ ...theme, assistantBubble: e.target.value })}
                    />
                    <span className="wg-color-hex">{theme.assistantBubble}</span>
                  </div>
                </div>

                <div className="wg-color-card">
                  <label>Background</label>
                  <div className="wg-color-row">
                    <input
                      type="color"
                      className="wg-color-input"
                      value={theme.background || "#F8FAFC"}
                      onChange={(e) => setTheme({ ...theme, background: e.target.value })}
                    />
                    <span className="wg-color-hex">{theme.background}</span>
                  </div>
                </div>

                <div className="wg-color-card">
                  <label>Border</label>
                  <div className="wg-color-row">
                    <input
                      type="color"
                      className="wg-color-input"
                      value={theme.border || "#E2E8F0"}
                      onChange={(e) => setTheme({ ...theme, border: e.target.value })}
                    />
                    <span className="wg-color-hex">{theme.border}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Typography & Radius Section */}
            <section className="wg-section">
              <h2>Typography & Shapes</h2>
              <div className="wg-field">
                <label>Font Family</label>
                <select
                  value={theme.fontFamily || "Inter"}
                  onChange={(e) => setTheme({ ...theme, fontFamily: e.target.value })}
                  className="wg-select"
                >
                  {FONT_OPTIONS.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </div>

              <div className="wg-field">
                <label>Border Radius</label>
                <div className="wg-radio-group">
                  {RADIUS_OPTIONS.map((opt) => (
                    <div
                      key={opt.value}
                      className={`wg-radio-card ${theme.borderRadius === opt.value ? "selected" : ""}`}
                      onClick={() => setTheme({ ...theme, borderRadius: opt.value })}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Launcher & Position Section */}
            <section className="wg-section">
              <h2>Launcher & Position</h2>
              <div className="wg-field">
                <label>Launcher Style</label>
                <div className="wg-radio-group">
                  {(["CIRCLE", "ROUNDED", "SQUARE", "GLASS", "MINIMAL"] as LauncherStyle[]).map((style) => (
                    <div
                      key={style}
                      className={`wg-radio-card ${theme.launcherStyle === style ? "selected" : ""}`}
                      onClick={() => setTheme({ ...theme, launcherStyle: style })}
                    >
                      {style}
                    </div>
                  ))}
                </div>
              </div>

              <div className="wg-field">
                <label>Position</label>
                <div className="wg-radio-group">
                  {(["BOTTOM_RIGHT", "BOTTOM_LEFT"] as WidgetPosition[]).map((pos) => (
                    <div
                      key={pos}
                      className={`wg-radio-card ${theme.position === pos ? "selected" : ""}`}
                      onClick={() => setTheme({ ...theme, position: pos })}
                    >
                      {pos === "BOTTOM_RIGHT" ? "Bottom Right" : "Bottom Left"}
                    </div>
                  ))}
                </div>
              </div>

              <div className="wg-field">
                <label>Entrance Animation</label>
                <div className="wg-radio-group">
                  {(["FADE", "SLIDE", "BOUNCE", "NONE"] as WidgetAnimation[]).map((anim) => (
                    <div
                      key={anim}
                      className={`wg-radio-card ${theme.animation === anim ? "selected" : ""}`}
                      onClick={() => setTheme({ ...theme, animation: anim })}
                    >
                      {anim}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <button
              type="submit"
              className="btn-dark"
              disabled={saving || isReadOnly}
              style={{ alignSelf: "flex-start", padding: "12px 28px" }}
            >
              {saving ? "Saving Changes..." : "Save Appearance"}
            </button>
          </fieldset>
        </form>

        {/* Live Preview Column */}
        <div className="wg-preview-column">
          <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-soft)", textTransform: "uppercase" }}>
              ⚡ Live Preview (Realtime)
            </span>
          </div>
          <WidgetPreview theme={theme} />
        </div>
      </div>

      {toast && <div className="wg-toast">{toast}</div>}
    </div>
  );
}
