"use client";

import React, { useEffect, useState } from "react";
import { useSubscription } from "@/components/providers/SubscriptionProvider";
import "./widget.css";

export default function WidgetPage() {
  const { isReadOnly } = useSubscription();
  const [accentColor, setAccentColor] = useState("#1EE67A");
  const [engagementDelay, setEngagementDelay] = useState(5);
  const [exitIntent, setExitIntent] = useState(true);
  const [showProductImages, setShowProductImages] = useState(true);
  const [playSounds, setPlaySounds] = useState(true);
  const [widgetPublicKey, setWidgetPublicKey] = useState<string | null>(null);
  const [allowedDomains, setAllowedDomains] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/workspace/settings")
      .then((r) => r.json())
      .then((data) => {
        if (!data.settings) return;
        const s = data.settings;
        if (s.accentColor) setAccentColor(s.accentColor);
        if (s.engagementDelay) setEngagementDelay(s.engagementDelay);
        if (s.features) {
          setExitIntent(s.features.exitIntent ?? true);
          setShowProductImages(s.features.showProductImages ?? true);
          setPlaySounds(s.features.playSounds ?? true);
        }
        setWidgetPublicKey(s.widgetPublicKey ?? null);
        setAllowedDomains(Array.isArray(s.allowedDomains) ? s.allowedDomains.join("\n") : "");
      })
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/workspace/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accentColor,
          engagementDelay,
          allowedDomains,
          features: { exitIntent, showProductImages, playSounds },
        }),
      });
      if (res.ok) {
        setToast("Widget settings saved.");
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const snippet = widgetPublicKey
    ? `<script
  src="${typeof window !== "undefined" ? window.location.origin : "https://midevela.com"}/widget/midevela-widget.js"
  data-widget-key="${widgetPublicKey}"
  data-theme-color="${accentColor}"
  async>
</script>`
    : null;

  return (
    <div>
      <div className="wg-page-head">
        <div className="eyebrow"><span className="dot"></span> WIDGET</div>
        <h1>Widget</h1>
        <p className="wg-subtitle">Customise the look, feel, and behaviour of your embedded AI sales widget.</p>
      </div>

      <form onSubmit={handleSave} className="wg-form">
        <fieldset disabled={isReadOnly} style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 24 }}>
          <section className="wg-section">
            <h2>Appearance</h2>
            <div className="wg-field">
              <label>Widget accent colour</label>
              <div className="wg-color-row">
                <input type="color" className="wg-color-input" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
                <span className="wg-color-hex">{accentColor}</span>
              </div>
            </div>
            <div className="wg-field">
              <label>Smart engagement delay (seconds)</label>
              <div className="wg-slider-row">
                <input type="range" min="5" max="60" step="5" value={engagementDelay} onChange={(e) => setEngagementDelay(Number(e.target.value))} />
                <span className="wg-slider-value">{engagementDelay}s</span>
              </div>
              <p className="wg-hint">Delay after page load before the AI prompts visitors with a greeting.</p>
            </div>
          </section>

          <section className="wg-section">
            <h2>Features</h2>
            <div className="wg-checkboxes">
              <label className="wg-check-row">
                <input type="checkbox" checked={exitIntent} onChange={(e) => setExitIntent(e.target.checked)} />
                <div>
                  <strong>Exit-intent recovery</strong>
                  <span>Show a popup when a visitor is about to leave the page.</span>
                </div>
              </label>
              <label className="wg-check-row">
                <input type="checkbox" checked={showProductImages} onChange={(e) => setShowProductImages(e.target.checked)} />
                <div>
                  <strong>Product images in recommendations</strong>
                  <span>Display product photos inside AI recommendation cards.</span>
                </div>
              </label>
              <label className="wg-check-row">
                <input type="checkbox" checked={playSounds} onChange={(e) => setPlaySounds(e.target.checked)} />
                <div>
                  <strong>Sound on incoming message</strong>
                  <span>Play a subtle chime when the AI sends a new message.</span>
                </div>
              </label>
            </div>
          </section>

          <section className="wg-section">
            <h2>Domain Restrictions</h2>
            <div className="wg-field">
              {allowedDomains.trim() === "" && (
                <p className="wg-warning">Your widget can currently be embedded on any website. Add domains below to restrict it.</p>
              )}
              <textarea rows={3} value={allowedDomains} onChange={(e) => setAllowedDomains(e.target.value)}
                placeholder="Leave empty to allow the widget on any site"
                style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
              />
              <p className="wg-hint">One domain per line. Subdomains of a listed domain are allowed automatically.</p>
            </div>
          </section>

          <section className="wg-section">
            <h2>Installation</h2>
            <div className="wg-field">
              <p className="wg-hint" style={{ marginBottom: 2 }}>Paste this script before the closing <code>&lt;/body&gt;</code> tag of your website.</p>
              <div className="wg-code-block">
                <pre>{snippet ?? "Finish setting up your widget key first."}</pre>
                <button type="button" className="wg-copy-btn" disabled={!snippet}
                  onClick={() => {
                    if (!snippet) return;
                    navigator.clipboard.writeText(snippet);
                    setToast("Snippet copied to clipboard.");
                    setTimeout(() => setToast(null), 3000);
                  }}>
                  Copy code
                </button>
              </div>
            </div>
          </section>

          <button type="submit" className="btn-dark" style={{ alignSelf: "flex-end", padding: "12px 24px" }}>
            Save settings
          </button>
        </fieldset>
      </form>

      {toast && <div className="wg-toast">{toast}</div>}
    </div>
  );
}
