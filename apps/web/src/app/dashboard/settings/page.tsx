"use client";

import React, { useState, useEffect } from "react";
import { useSubscription } from "@/components/providers/SubscriptionProvider";
import "./settings.css";

interface TeamMember {
  name: string;
  email: string;
  role: string;
}

export default function SettingsPage() {
  const { isReadOnly } = useSubscription();
  const [activeTab, setActiveTab] = useState<"org" | "widget" | "team">("org");
  const [orgName, setOrgName] = useState("LuxeStyle NG");
  const [website, setWebsite] = useState("luxestyle.ng");
  const [country, setCountry] = useState("Nigeria");
  const [currency, setCurrency] = useState("NGN");
  const [accentColor, setAccentColor] = useState("#1EE67A");
  const [engagementDelay, setEngagementDelay] = useState(5);
  const [exitIntent, setExitIntent] = useState(true);
  const [showProductImages, setShowProductImages] = useState(true);
  const [playSounds, setPlaySounds] = useState(true);
  const [widgetPublicKey, setWidgetPublicKey] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Agent");
  const [teamList, setTeamList] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    fetch("/api/workspace/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setOrgName(data.settings.orgName);
          setWebsite(data.settings.website);
          setCountry(data.settings.country || "Nigeria");
          setCurrency(data.settings.currency || "NGN");
          setAccentColor(data.settings.accentColor);
          setEngagementDelay(data.settings.engagementDelay);
          if (data.settings.features) {
            setExitIntent(data.settings.features.exitIntent);
            setShowProductImages(data.settings.features.showProductImages);
            setPlaySounds(data.settings.features.playSounds);
          }
          setWidgetPublicKey(data.settings.widgetPublicKey ?? null);
        }
      })
      .catch((err) => console.error("Error loading settings:", err));

    fetch("/api/team")
      .then((res) => res.json())
      .then((data) => setTeamList(Array.isArray(data.team) ? data.team : []))
      .catch(() => setTeamList([]))
      .finally(() => setTeamLoading(false));

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "team" || tab === "widget" || tab === "org") {
        setActiveTab(tab as any);
      }
    }
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/workspace/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName, website, country, currency }),
      });
      if (res.ok) showToast("Business profile updated.");
    } catch (err) {
      console.error("Failed to save profile:", err);
    }
  };

  const handleSaveWidget = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/workspace/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accentColor,
          engagementDelay,
          features: { exitIntent, showProductImages, playSounds },
        }),
      });
      if (res.ok) showToast("Widget settings updated.");
    } catch (err) {
      console.error("Failed to save widget settings:", err);
    }
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    // No invite backend exists yet - no user is created, nobody gains
    // access. Say so plainly rather than pretending this succeeded,
    // since "invited" implies someone now has real access to the
    // dashboard.
    showToast("Team invites aren't available yet — coming in a future update.");
    setInviteEmail("");
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
      <div className="set-page-head">
        <div className="eyebrow">
          <span className="dot"></span> CONFIGURATION
        </div>
        <h1>Settings</h1>
      </div>

      <div className="tabs" role="tablist" style={{ marginBottom: 22 }}>
        {(["org", "widget", "team"] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={`tab ${activeTab === tab ? "tab-active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "org" ? "Business Profile" : tab === "widget" ? "Widget Customisation" : "Team & Access"}
          </button>
        ))}
      </div>

      {activeTab === "org" && (
        <form onSubmit={handleSaveProfile} className="set-card">
          <span className="set-card-title">Business profile</span>
          <fieldset disabled={isReadOnly} style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 22 }}>
            <div className="set-field">
              <label htmlFor="settings-org">Business name</label>
              <input id="settings-org" type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            </div>
            <div className="set-field">
              <label htmlFor="settings-web">Connected website URL</label>
              <input id="settings-web" type="text" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            <div className="set-field-row">
              <div className="set-field">
                <label htmlFor="settings-country">Country</label>
                <select id="settings-country" value={country} onChange={(e) => setCountry(e.target.value)}>
                  <option value="Nigeria">Nigeria</option>
                  <option value="Ghana">Ghana</option>
                  <option value="Kenya">Kenya</option>
                </select>
              </div>
              <div className="set-field">
                <label htmlFor="settings-currency">Default currency</label>
                <select id="settings-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="NGN">Naira (₦)</option>
                  <option value="GHS">Cedi (₵)</option>
                  <option value="USD">Dollar ($)</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn-dark" style={{ alignSelf: "flex-end", padding: "12px 22px" }}>
              Save changes
            </button>
          </fieldset>
        </form>
      )}

      {activeTab === "widget" && (
        <form onSubmit={handleSaveWidget} className="set-card">
          <span className="set-card-title">Widget customisation</span>
          <fieldset disabled={isReadOnly} style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 22 }}>
            <div className="set-field">
              <label>Widget primary accent color</label>
              <div className="set-color-row">
                <input type="color" className="set-color-input" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
                <span className="set-color-hex">{accentColor}</span>
              </div>
            </div>

            <div className="set-field">
              <label>Smart engagement delay (seconds)</label>
              <div className="set-slider-row">
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={engagementDelay}
                  onChange={(e) => setEngagementDelay(Number(e.target.value))}
                />
                <span className="set-slider-value">{engagementDelay}s</span>
              </div>
              <p className="set-hint">Delay after page load before the AI prompts visitors with a context greeting.</p>
            </div>

            <div className="set-field">
              <label>Features enabled</label>
              <div className="set-checkbox-list">
                <label className="set-checkbox-row">
                  <input type="checkbox" checked={exitIntent} onChange={(e) => setExitIntent(e.target.checked)} />
                  Enable exit-intent recovery popup
                </label>
                <label className="set-checkbox-row">
                  <input type="checkbox" checked={showProductImages} onChange={(e) => setShowProductImages(e.target.checked)} />
                  Show product images in recommendation cards
                </label>
                <label className="set-checkbox-row">
                  <input type="checkbox" checked={playSounds} onChange={(e) => setPlaySounds(e.target.checked)} />
                  Play sound on incoming message
                </label>
              </div>
            </div>

            <div className="set-field">
              <label>Widget installation snippet</label>
              <p className="set-hint" style={{ marginBottom: 2 }}>
                Paste this script before the closing <code>&lt;/body&gt;</code> tag of your store.
              </p>
              <div className="set-code-block">
                <pre>{snippet ?? "Loading your widget key…"}</pre>
                <button
                  type="button"
                  className="set-copy-btn"
                  disabled={!snippet}
                  onClick={() => {
                    if (!snippet) return;
                    navigator.clipboard.writeText(snippet);
                    showToast("Snippet copied to clipboard.");
                  }}
                >
                  Copy code
                </button>
              </div>
            </div>

            <button type="submit" className="btn-dark" style={{ alignSelf: "flex-end", padding: "12px 22px" }}>
              Save settings
            </button>
          </fieldset>
        </form>
      )}

      {activeTab === "team" && (
        <div className="grid-2">
          <div className="card">
            <div className="card-head">
              <h3>Active team members</h3>
            </div>
            <div>
              {teamLoading ? (
                <div style={{ padding: 20, color: "var(--ink-soft)" }}>Loading…</div>
              ) : (
                teamList.map((m) => (
                  <div key={m.email} className="set-team-row">
                    <div className="set-team-avatar">{m.name[0]}</div>
                    <div className="set-team-info">
                      <div className="set-team-name">{m.name}</div>
                      <div className="set-team-email">{m.email}</div>
                    </div>
                    <span className="badge badge-muted">{m.role}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Invite team member</h3>
            </div>
            <p className="set-hint" style={{ marginBottom: 16 }}>
              Team invites aren&apos;t built yet — every account is currently a single owner. This form doesn&apos;t grant anyone access.
            </p>
            <form onSubmit={handleInvite} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <fieldset disabled={isReadOnly} style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="set-field">
                  <label htmlFor="invite-em">Email address</label>
                  <input
                    id="invite-em"
                    type="email"
                    placeholder="name@business.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="set-field">
                  <label htmlFor="invite-role">Role</label>
                  <select id="invite-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                    <option value="Admin">Admin (full settings)</option>
                    <option value="Agent">Agent (manual takeover only)</option>
                  </select>
                </div>
                <button type="submit" className="btn-dark" style={{ padding: "12px 0", marginTop: 4 }}>
                  Send invitation
                </button>
              </fieldset>
            </form>
          </div>
        </div>
      )}

      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "var(--pine-black)",
            color: "var(--paper)",
            padding: "12px 22px",
            borderRadius: "var(--radius-pill)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            zIndex: 1000,
          }}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
