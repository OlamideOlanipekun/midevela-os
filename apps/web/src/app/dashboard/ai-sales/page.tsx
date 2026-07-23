"use client";

import React, { useEffect, useState } from "react";
import { useSubscription } from "@/components/providers/SubscriptionProvider";
import "./ai-sales.css";

export default function AISalesPage() {
  const { isReadOnly } = useSubscription();
  const [aiName, setAiName] = useState("Lumi");
  const [tone, setTone] = useState("friendly");
  const [greeting, setGreeting] = useState("Good day! Welcome. How can I help you today?");
  const [sellsDescription, setSellsDescription] = useState("");
  const [neverSay, setNeverSay] = useState("");
  const [businessHoursOpen, setBusinessHoursOpen] = useState("9:00 AM");
  const [businessHoursClose, setBusinessHoursClose] = useState("6:00 PM");
  const [channels, setChannels] = useState<string[]>(["website"]);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/workspace/settings")
      .then((r) => r.json())
      .then((data) => {
        if (!data.settings) return;
        const s = data.settings;
        if (s.aiName) setAiName(s.aiName);
        if (s.tone) setTone(s.tone);
        if (s.greeting) setGreeting(s.greeting);
        if (s.sellsDescription) setSellsDescription(s.sellsDescription);
        if (s.neverSay) setNeverSay(s.neverSay);
        if (s.businessHours) {
          setBusinessHoursOpen(s.businessHours.open || "9:00 AM");
          setBusinessHoursClose(s.businessHours.close || "6:00 PM");
        }
        if (s.channels) setChannels(s.channels);
        if (s.whatsappNumber) setWhatsappNumber(s.whatsappNumber);
      })
      .catch(() => {});
  }, []);

  const toggleChannel = (ch: string) => {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/workspace/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiName,
          tone,
          greeting,
          sellsDescription,
          neverSay,
          businessHours: { open: businessHoursOpen, close: businessHoursClose },
          channels,
          whatsappNumber,
        }),
      });
      if (res.ok) {
        setToast("AI Sales settings saved.");
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="as-page-head">
        <div className="eyebrow"><span className="dot"></span> AI SALES</div>
        <h1>AI Sales</h1>
        <p className="as-subtitle">Configure how your AI sales agent behaves, speaks, and sells.</p>
      </div>

      <form onSubmit={handleSave} className="as-form">
        <fieldset disabled={isReadOnly} style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 24 }}>
          <section className="as-section">
            <h2>Identity & Voice</h2>
            <div className="as-grid">
              <div className="as-field">
                <label htmlFor="ai-name">Agent name</label>
                <input id="ai-name" type="text" value={aiName} onChange={(e) => setAiName(e.target.value)} placeholder="Lumi" />
                <p className="as-hint">The name customers see in the widget header.</p>
              </div>
              <div className="as-field">
                <label htmlFor="tone">Tone of voice</label>
                <select id="tone" value={tone} onChange={(e) => setTone(e.target.value)}>
                  <option value="friendly">Friendly & warm</option>
                  <option value="professional">Professional & polished</option>
                  <option value="casual">Casual & relaxed</option>
                  <option value="luxury">Luxury & refined</option>
                </select>
              </div>
            </div>

            <div className="as-field">
              <label htmlFor="greeting">Greeting message</label>
              <textarea id="greeting" rows={2} value={greeting} onChange={(e) => setGreeting(e.target.value)} />
              <p className="as-hint">First message every visitor sees. Keep it warm and inviting.</p>
            </div>
          </section>

          <section className="as-section">
            <h2>What You Sell</h2>
            <div className="as-field">
              <label htmlFor="sells-desc">Describe your business</label>
              <textarea id="sells-desc" rows={4} value={sellsDescription} onChange={(e) => setSellsDescription(e.target.value)} placeholder="e.g. We sell organic skincare products for men and women — moisturisers, serums, cleansers, and gift sets. Prices range from ₦5,000 to ₦35,000." />
              <p className="as-hint">The AI uses this to understand your catalogue and recommend the right products. Be specific about what you sell and your price range.</p>
            </div>
          </section>

          <section className="as-section">
            <h2>Guardrails</h2>
            <div className="as-field">
              <label htmlFor="never-say">Never say</label>
              <textarea id="never-say" rows={3} value={neverSay} onChange={(e) => setNeverSay(e.target.value)} placeholder="e.g. Don't mention competitors, don't guarantee results, don't make medical claims" />
              <p className="as-hint">Topics or phrases the AI must avoid. One per line.</p>
            </div>
          </section>

          <section className="as-section">
            <h2>Business Hours</h2>
            <div className="as-grid">
              <div className="as-field">
                <label htmlFor="hours-open">Opening time</label>
                <select id="hours-open" value={businessHoursOpen} onChange={(e) => setBusinessHoursOpen(e.target.value)}>
                  {["6:00 AM","7:00 AM","8:00 AM","9:00 AM","10:00 AM"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="as-field">
                <label htmlFor="hours-close">Closing time</label>
                <select id="hours-close" value={businessHoursClose} onChange={(e) => setBusinessHoursClose(e.target.value)}>
                  {["4:00 PM","5:00 PM","6:00 PM","7:00 PM","8:00 PM","9:00 PM","10:00 PM"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="as-hint">Outside these hours the widget will show an away message instead of the greeting.</p>
          </section>

          <section className="as-section">
            <h2>Sales Channels</h2>
            <p className="as-hint" style={{ marginTop: -8 }}>Select which channels the AI agent is active on. Coming soon: WhatsApp, Instagram, Facebook.</p>
            <div className="as-channels">
              {[
                { id: "website", label: "Website Widget", desc: "Your store's embedded widget" },
                { id: "whatsapp", label: "WhatsApp", desc: "Connect your WhatsApp Business number" },
                { id: "instagram", label: "Instagram", desc: "Direct messages from Instagram" },
                { id: "facebook", label: "Facebook Messenger", desc: "Messages from your Facebook page" },
              ].map((ch) => (
                <label key={ch.id} className={`as-channel ${channels.includes(ch.id) ? "active" : ""}`}>
                  <input type="checkbox" checked={channels.includes(ch.id)} onChange={() => toggleChannel(ch.id)} />
                  <div>
                    <strong>{ch.label}</strong>
                    <span>{ch.desc}</span>
                  </div>
                </label>
              ))}
            </div>
            {channels.includes("whatsapp") && (
              <div className="as-field" style={{ marginTop: 12 }}>
                <label htmlFor="wa-number">WhatsApp Business number</label>
                <input id="wa-number" type="text" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="+2348012345678" />
              </div>
            )}
          </section>

          <button type="submit" className="btn-dark" style={{ alignSelf: "flex-end", padding: "12px 24px" }}>
            Save settings
          </button>
        </fieldset>
      </form>

      {toast && (
        <div className="as-toast">{toast}</div>
      )}
    </div>
  );
}
