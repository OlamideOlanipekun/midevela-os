"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import "./onboarding.css";

const toneGreetings: Record<string, string> = {
  "Friendly & warm": "Hey! 👋 Welcome to LuxeStyle. What are you looking for today?",
  "Professional": "Welcome to LuxeStyle. How may I assist you today?",
  "Luxury": "Welcome. I'm here to help you discover the perfect beauty experience.",
  "Bold & direct": "Hi. What do you need?",
  "Playful & fun": "Heyy! ✨💕 LuxeStyle in the building! What are we shopping for?",
  "Custom": "Hi! I'm here to help. What can I do for you today?"
};

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(2);
  const [loading, setLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Form states
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("Fashion & Retail");
  const [sellsDesc, setSellsDesc] = useState("");
  const [openingTime, setOpeningTime] = useState("10:00 AM");
  const [closingTime, setClosingTime] = useState("8:00 PM");
  const [currency, setCurrency] = useState("Nigerian Naira (₦)");

  // Channels
  const [channels, setChannels] = useState<string[]>(["wa"]);
  const [waNumber, setWaNumber] = useState("");

  // Catalog
  const [catalogSource, setCatalogSource] = useState("crawl");
  const [websiteUrl, setWebsiteUrl] = useState("https://luxestyle.ng");

  // AI voice
  const [aiName, setAiName] = useState("Lumi");
  const [selectedTone, setSelectedTone] = useState("Friendly & warm");
  const [neverSay, setNeverSay] = useState("");
  const [greeting, setGreeting] = useState("Hey! 👋 Welcome to Lumina Beauty Co.. What are you looking for today?");

  // Update live preview values when states change
  useEffect(() => {
    const greetingText = toneGreetings[selectedTone] || toneGreetings["Friendly & warm"];
    const biz = businessName || "Lumina Beauty Co.";
    setGreeting(greetingText.replace(/LuxeStyle/g, biz));
  }, [selectedTone, businessName]);

  const handleToggleChannel = (ch: string) => {
    if (channels.includes(ch)) {
      setChannels(channels.filter((c) => c !== ch));
    } else {
      setChannels([...channels, ch]);
    }
  };

  const handleCopySnippet = () => {
    const snippetCode = `<!-- Midevela AI Counter -->\n<script>\n  (function(m,i,d,e,v,l,a){\n    m['MidevelaObject']=v;\n    m[v]=m[v]||function(){(m[v].q=m[v].q||[]).push(arguments)};\n    l=i.createElement(d);l.async=1;\n    l.src='https://cdn.midevela.com/v1/counter.js';\n    a=i.getElementsByTagName(d)[0];\n    a.parentNode.insertBefore(l,a);\n  })(window,document,'script','','mdv');\n  mdv('init', 'workspace_tk_xk92jw');\n</script>`;
    navigator.clipboard.writeText(snippetCode);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleLaunch = async () => {
    setLoading(true);
    try {
      // POST the user's configurations to persistent settings
      const res = await fetch("/api/workspace/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: businessName || "Lumina Beauty Co.",
          tone: selectedTone.toLowerCase(),
          greeting: greeting,
          accentColor: "#1E6F64",
          delaySeconds: 3,
          exitIntent: true
        })
      });
      if (res.ok) {
        router.push("/dashboard");
      } else {
        alert("Failed to save settings. Please try launching again.");
      }
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
      // Fallback redirect
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    setCurrentStep(6);
  };

  const handleNext = () => {
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 2) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="onboarding-page-wrapper">
      <div className="shell">
        
        {/* TOP BAR */}
        <header className="topbar">
          <div className="tb-logo">
            <Image src="/logo-mark-light.png" alt="" width={22} height={22} style={{ objectFit: "contain" }} />
            Midevela
          </div>
          <div className="tb-center mono">Setting up your counter</div>
          <button className="tb-skip" onClick={handleSkip}>
            Skip setup →
          </button>
        </header>

        {/* PROGRESS RAIL */}
        <aside className="rail">
          <div className="rail-heading">Setup steps</div>

          <div className="rail-step done">
            <div className="step-num">✓</div>
            <div className="step-info">
              <div className="step-label">Account created</div>
              <div className="step-sublabel">Identity confirmed</div>
            </div>
          </div>

          <div className={`rail-step ${currentStep === 2 ? "active" : currentStep > 2 ? "done" : ""}`}>
            <div className="step-num">{currentStep > 2 ? "✓" : "2"}</div>
            <div className="step-info">
              <div className="step-label">Your business</div>
              <div className="step-sublabel">Name, industry, hours</div>
            </div>
          </div>

          <div className={`rail-step ${currentStep === 3 ? "active" : currentStep > 3 ? "done" : ""}`}>
            <div className="step-num">{currentStep > 3 ? "✓" : "3"}</div>
            <div className="step-info">
              <div className="step-label">Connect channels</div>
              <div className="step-sublabel">WhatsApp, IG, website</div>
            </div>
          </div>

          <div className={`rail-step ${currentStep === 4 ? "active" : currentStep > 4 ? "done" : ""}`}>
            <div className="step-num">{currentStep > 4 ? "✓" : "4"}</div>
            <div className="step-info">
              <div className="step-label">Import catalog</div>
              <div className="step-sublabel">Products & services</div>
            </div>
          </div>

          <div className={`rail-step ${currentStep === 5 ? "active" : currentStep > 5 ? "done" : ""}`}>
            <div className="step-num">{currentStep > 5 ? "✓" : "5"}</div>
            <div className="step-info">
              <div className="step-label">Train your AI</div>
              <div className="step-sublabel">Brand voice & rules</div>
            </div>
          </div>

          <div className={`rail-step ${currentStep === 6 ? "active" : ""}`}>
            <div className="step-num">6</div>
            <div className="step-info">
              <div className="step-label">Install widget</div>
              <div className="step-sublabel">One line of code</div>
            </div>
          </div>

          <div className="rail-eta">
            <span className="eta-num">~{Math.max(1, 7 - currentStep)} min</span> setup remaining
          </div>
        </aside>

        {/* STEP CONTENT */}
        <main className="content">

          {/* STEP 2: Business Info */}
          {currentStep === 2 && (
            <div className="step-panel active">
              <div className="step-eyebrow">
                <span className="dot"></span> Step 2 of 6
              </div>
              <h2 className="display">Tell us about your business</h2>
              <p className="step-desc">
                This is how your AI introduces itself to customers and tailors recommendations to your products.
              </p>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="biz-name">Business name</label>
                  <input
                    type="text"
                    id="biz-name"
                    placeholder="e.g. Lumina Beauty Co."
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="biz-industry">Industry</label>
                  <select
                    id="biz-industry"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                  >
                    <option value="Fashion & Retail">Fashion & Retail</option>
                    <option value="Beauty & Cosmetics">Beauty & Cosmetics</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Food & Beverage">Food & Beverage</option>
                    <option value="Furniture & Home">Furniture & Home</option>
                    <option value="Professional Services">Professional Services</option>
                    <option value="Real Estate">Real Estate</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label htmlFor="biz-sell">What do you sell? (one line)</label>
                <input
                  type="text"
                  id="biz-sell"
                  placeholder="e.g. Premium skincare and beauty products for Nigerian women"
                  value={sellsDesc}
                  onChange={(e) => setSellsDesc(e.target.value)}
                />
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="biz-open">Business opening time</label>
                  <select
                    id="biz-open"
                    value={openingTime}
                    onChange={(e) => setOpeningTime(e.target.value)}
                  >
                    <option value="8:00 AM">8:00 AM</option>
                    <option value="9:00 AM">9:00 AM</option>
                    <option value="10:00 AM">10:00 AM</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="biz-close">Business closing time</label>
                  <select
                    id="biz-close"
                    value={closingTime}
                    onChange={(e) => setClosingTime(e.target.value)}
                  >
                    <option value="6:00 PM">6:00 PM</option>
                    <option value="8:00 PM">8:00 PM</option>
                    <option value="10:00 PM">10:00 PM</option>
                    <option value="24/7 (Always open)">24/7 (Always open)</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label htmlFor="biz-currency">Currency</label>
                <select
                  id="biz-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="Nigerian Naira (₦)">Nigerian Naira (₦)</option>
                  <option value="US Dollar ($)">US Dollar ($)</option>
                  <option value="British Pound (£)">British Pound (£)</option>
                </select>
              </div>

              <div className="step-nav">
                <div></div>
                <button className="btn-next" onClick={handleNext}>
                  Connect channels →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Connect channels */}
          {currentStep === 3 && (
            <div className="step-panel active">
              <div className="step-eyebrow">
                <span className="dot"></span> Step 3 of 6
              </div>
              <h2 className="display">Where do customers reach you?</h2>
              <p className="step-desc">
                Connect the channels your customers already use. Start with at least one.
              </p>

              <div className="channel-grid">
                <div
                  className={`channel-card whatsapp ${channels.includes("wa") ? "selected" : ""}`}
                  onClick={() => handleToggleChannel("wa")}
                >
                  <div className="ch-icon">💬</div>
                  <div className="ch-name">WhatsApp</div>
                  <div className="ch-desc">Most used in Nigeria — high conversion</div>
                </div>
                <div
                  className={`channel-card website ${channels.includes("web") ? "selected" : ""}`}
                  onClick={() => handleToggleChannel("web")}
                >
                  <div className="ch-icon">🌐</div>
                  <div className="ch-name">Website widget</div>
                  <div className="ch-desc">Embed on your site in one line</div>
                </div>
                <div
                  className={`channel-card instagram ${channels.includes("ig") ? "selected" : ""}`}
                  onClick={() => handleToggleChannel("ig")}
                >
                  <div className="ch-icon">📸</div>
                  <div className="ch-name">Instagram DMs</div>
                  <div className="ch-desc">Auto-reply to product enquiries</div>
                </div>
                <div
                  className={`channel-card facebook ${channels.includes("fb") ? "selected" : ""}`}
                  onClick={() => handleToggleChannel("fb")}
                >
                  <div className="ch-icon">👍</div>
                  <div className="ch-name">Facebook Messenger</div>
                  <div className="ch-desc">Page DMs and ad click-throughs</div>
                </div>
              </div>

              {/* WhatsApp QR Connect sub-panel */}
              <div className={`wa-panel ${channels.includes("wa") ? "visible" : ""}`}>
                <h4>Connect your WhatsApp Business number</h4>
                <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div className="wa-qr"></div>
                  <div className="wa-instructions">
                    <b>1.</b> Open WhatsApp on your phone<br />
                    <b>2.</b> Tap ⋮ → Linked Devices<br />
                    <b>3.</b> Tap "Link a Device"<br />
                    <b>4.</b> Scan this QR code<br /><br />
                    Or enter your WhatsApp Business API credentials manually below.
                  </div>
                </div>
                <div className="field" style={{ marginTop: "16px" }}>
                  <label htmlFor="wa-phone">WhatsApp phone number</label>
                  <input
                    type="tel"
                    id="wa-phone"
                    placeholder="+234…"
                    value={waNumber}
                    onChange={(e) => setWaNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="step-nav">
                <button className="btn-back" onClick={handleBack}>
                  ← Back
                </button>
                <button className="btn-next" onClick={handleNext}>
                  Import catalog →
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Import catalog */}
          {currentStep === 4 && (
            <div className="step-panel active">
              <div className="step-eyebrow">
                <span className="dot"></span> Step 4 of 6
              </div>
              <h2 className="display">Bring in your products</h2>
              <p className="step-desc">
                The AI needs to know what you sell before it can recommend anything. Pick the fastest route.
              </p>

              <div className="catalog-grid">
                <div
                  className={`catalog-card ${catalogSource === "crawl" ? "selected" : ""}`}
                  onClick={() => setCatalogSource("crawl")}
                >
                  <div className="cat-ico">🌐</div>
                  <div>
                    <div className="cat-name">Crawl my website</div>
                    <div className="cat-desc">We read your site and pull products automatically</div>
                  </div>
                </div>
                <div
                  className={`catalog-card ${catalogSource === "shopify" ? "selected" : ""}`}
                  onClick={() => setCatalogSource("shopify")}
                >
                  <div className="cat-ico">📦</div>
                  <div>
                    <div className="cat-name">Shopify / WooCommerce</div>
                    <div className="cat-desc">Connect your store in one click</div>
                  </div>
                </div>
                <div
                  className={`catalog-card ${catalogSource === "csv" ? "selected" : ""}`}
                  onClick={() => setCatalogSource("csv")}
                >
                  <div className="cat-ico">CSV</div>
                  <div>
                    <div className="cat-name">Upload CSV or Excel</div>
                    <div className="cat-desc">Import a spreadsheet of your products</div>
                  </div>
                </div>
                <div
                  className={`catalog-card ${catalogSource === "manual" ? "selected" : ""}`}
                  onClick={() => setCatalogSource("manual")}
                >
                  <div className="cat-ico">✏️</div>
                  <div>
                    <div className="cat-name">Add manually</div>
                    <div className="cat-desc">Enter products one by one (great for small stores)</div>
                  </div>
                </div>
              </div>

              {catalogSource === "crawl" && (
                <div className="field animate-fade-up">
                  <label htmlFor="ob-crawl-url">Your website URL</label>
                  <input
                    type="url"
                    id="ob-crawl-url"
                    placeholder="https://yourbusiness.com"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                  />
                </div>
              )}

              {catalogSource === "shopify" && (
                <div className="field animate-fade-up">
                  <label htmlFor="ob-shopify-domain">Shopify Store Domain</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      id="ob-shopify-domain"
                      placeholder="your-store.myshopify.com"
                      className="input"
                      style={{ flex: 1 }}
                    />
                    <button type="button" className="btn-next" style={{ height: "auto", margin: 0, padding: "0 20px" }}>Connect</button>
                  </div>
                </div>
              )}

              {catalogSource === "csv" && (
                <div className="field animate-fade-up" style={{ border: "2px dashed var(--line)", borderRadius: "var(--radius-md)", padding: "20px", textAlign: "center", cursor: "pointer", background: "var(--paper-raised)" }}>
                  <span style={{ fontSize: "2rem" }}>📁</span>
                  <div style={{ fontWeight: 600, fontSize: "14px", marginTop: "8px" }}>Drag & drop your CSV file here</div>
                  <div style={{ fontSize: "12px", color: "var(--ink-soft)", marginTop: "2px" }}>or click to browse your computer</div>
                </div>
              )}

              {catalogSource === "manual" && (
                <div className="field animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <label>Quick Add Product</label>
                  <div className="field-row" style={{ margin: 0 }}>
                    <input type="text" className="input" placeholder="Product name" />
                    <input type="text" className="input" placeholder="Price (e.g. 25000)" />
                  </div>
                </div>
              )}

              <div style={{ background: "var(--paper-raised)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: "16px", fontSize: "13.5px", color: "var(--ink-soft)", lineHeight: 1.5 }}>
                {catalogSource === "crawl" && "We'll scan your site and pull product names, descriptions, prices, and images into your AI catalog. This usually takes under 2 minutes. You can edit everything before it goes live."}
                {catalogSource === "shopify" && "Connect your Shopify/WooCommerce store to automatically sync products, descriptions, inventory, and pricing in real time."}
                {catalogSource === "csv" && "Upload a CSV, XLSX, or Google Sheets export of your inventory. Download our starter template to format your columns correctly."}
                {catalogSource === "manual" && "Enter your products one by one. Best for services, custom creations, or testing Midevela with a small catalog before syncing."}
              </div>

              <div className="step-nav">
                <button className="btn-back" onClick={handleBack}>
                  ← Back
                </button>
                <button className="btn-next" onClick={handleNext}>
                  Train your AI →
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: AI voice / rules */}
          {currentStep === 5 && (
            <div className="step-panel active">
              <div className="step-eyebrow">
                <span className="dot"></span> Step 5 of 6
              </div>
              <h2 className="display">How should your AI talk?</h2>
              <p className="step-desc">
                Your AI speaks as part of your brand. Set the tone so it sounds like you, not a generic bot.
              </p>

              <div className="field">
                <label htmlFor="ob-ai-name">What's your AI called?</label>
                <input
                  type="text"
                  id="ob-ai-name"
                  placeholder="e.g. Lumi, Ada, or just leave blank"
                  value={aiName}
                  onChange={(e) => setAiName(e.target.value)}
                />
              </div>

              <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-soft)", marginBottom: "12px" }}>
                Brand tone
              </div>
              
              <div className="tone-grid">
                {[
                  { name: "Friendly & warm", emoji: "😊", desc: "Approachable, helpful, conversational" },
                  { name: "Professional", emoji: "💼", desc: "Confident, polished, business-like" },
                  { name: "Luxury", emoji: "✨", desc: "Elevated, exclusive, aspirational" },
                  { name: "Bold & direct", emoji: "⚡", desc: "No fluff, fast answers, gets to the point" },
                  { name: "Playful & fun", emoji: "🎉", desc: "Energetic, casual, Gen Z-friendly" },
                  { name: "Custom", emoji: "🤝", desc: "Write your own instructions below" }
                ].map((toneItem) => (
                  <div
                    key={toneItem.name}
                    className={`tone-card ${selectedTone === toneItem.name ? "selected" : ""}`}
                    onClick={() => setSelectedTone(toneItem.name)}
                  >
                    <div className="tone-emoji">{toneItem.emoji}</div>
                    <div className="tone-name">{toneItem.name}</div>
                    <div className="tone-desc">{toneItem.desc}</div>
                  </div>
                ))}
              </div>

              <div className="field">
                <label htmlFor="ob-neversay">Anything the AI should never say or do?</label>
                <textarea
                  id="ob-neversay"
                  placeholder="e.g. Never mention competitor brands. Never offer discounts unless I've set one. Always offer to call back if the customer prefers."
                  value={neverSay}
                  onChange={(e) => setNeverSay(e.target.value)}
                />
              </div>

              <div className="step-nav">
                <button className="btn-back" onClick={handleBack}>
                  ← Back
                </button>
                <button className="btn-next" onClick={handleNext}>
                  Install widget →
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: Install widget */}
          {currentStep === 6 && (
            <div className="step-panel active">
              <div className="step-eyebrow">
                <span className="dot"></span> Step 6 of 6 — Almost live!
              </div>
              <h2 className="display">Install your AI counter</h2>
              <p className="step-desc">
                Paste this snippet before the closing &lt;/body&gt; tag on your website. It loads asynchronously with zero impact on speed.
              </p>

              <div className="snippet-box">
                <button className="snippet-copy" onClick={handleCopySnippet}>
                  {copySuccess ? "Copied!" : "Copy"}
                </button>
                <code>{`<!-- Midevela AI Counter -->\n<script>\n  (function(m,i,d,e,v,l,a){\n    m['MidevelaObject']=v;\n    m[v]=m[v]||function(){(m[v].q=m[v].q||[]).push(arguments)};\n    l=i.createElement(d);l.async=1;\n    l.src='https://cdn.midevela.com/v1/counter.js';\n    a=i.getElementsByTagName(d)[0];\n    a.parentNode.insertBefore(l,a);\n  })(window,document,'script','','mdv');\n  mdv('init', 'workspace_tk_xk92jw');\n</script>`}</code>
              </div>

              <div className="install-options">
                <button className="install-btn primary">📦 Install Shopify App</button>
                <button className="install-btn">🔌 WordPress Plugin</button>
                <button className="install-btn">📧 Email to developer</button>
              </div>

              <div style={{ marginTop: "24px", background: "#fff", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: "18px", display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#E7F3F0", display: "flex", alignItems: "center", fontSize: "18px", flexShrink: 0, justifyContent: "center" }}>
                  ✅
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>Widget already installed?</div>
                  <div style={{ fontSize: "13px", color: "var(--ink-soft)", marginTop: "2px" }}>
                    If you installed the snippet on a previous account, your counter is already active.
                  </div>
                </div>
              </div>

              <div className="step-nav">
                <button className="btn-back" onClick={handleBack}>
                  ← Back
                </button>
                <button className="btn-next teal" onClick={handleLaunch} disabled={loading}>
                  {loading ? "Launching..." : "🚀 Launch my counter →"}
                </button>
              </div>
            </div>
          )}

        </main>

        {/* LIVE PREVIEW (right column) */}
        <aside className="preview-col">
          <div className="preview-label">
            <span className="dot"></span> Live preview
          </div>

          {/* Step 2 preview: access pass */}
          {currentStep === 2 && (
            <div id="preview-2">
              <div className="pass-mini">
                <div className="pm-kicker">Midevela — AI Counter</div>
                <div className="pm-name display">{businessName || "Lumina Beauty Co."}</div>
                <div className="pm-tag">Industry · {industry}</div>
                <div className="pm-bar"></div>
              </div>
              <p className="preview-note">Your access pass is generated automatically when you complete this step.</p>
            </div>
          )}

          {/* Step 3 preview: widget */}
          {currentStep === 3 && (
            <div id="preview-3">
              <div className="preview-widget">
                <div className="pw-head" style={{ background: "var(--ink)" }}>
                  <div className="pw-avatar">{businessName ? businessName.charAt(0).toUpperCase() : "L"}</div>
                  <div>
                    <div className="pw-name" style={{ color: "#fff" }}>
                      {businessName || "Lumina Beauty Co."}
                    </div>
                    <div className="pw-status">
                      <span className="pw-dot"></span> Active now
                    </div>
                  </div>
                </div>
                <div className="pw-body">
                  <div className="pw-bubble">
                    Hey! Welcome to {businessName || "Lumina Beauty Co."}. What are you looking for today? 👋
                  </div>
                  <div className="pw-chips">
                    <button className="pw-chip">Browse products</button>
                    <button className="pw-chip">I need a recommendation</button>
                    <button className="pw-chip">I have a question</button>
                  </div>
                  <div className="pw-input-row">
                    <div className="pw-input">Type a message…</div>
                    <div className="pw-send">→</div>
                  </div>
                </div>
              </div>
              <p className="preview-note">This is exactly how your widget will look to customers after installation.</p>
            </div>
          )}

          {/* Step 4 preview: progress */}
          {currentStep === 4 && (
            <div id="preview-4">
              <div style={{ background: "var(--paper-raised)", border: "1px solid var(--line-dark)", borderRadius: "var(--radius-lg)", padding: "18px" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#5E7268", marginBottom: "14px" }}>
                  Catalog import progress
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", marginBottom: "5px" }}>
                      <span>Scanning pages</span>
                      <span style={{ color: "var(--teal-bright)" }}>Done ✓</span>
                    </div>
                    <div style={{ height: "5px", background: "var(--line-dark)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: "100%", background: "var(--teal)", borderRadius: "4px" }}></div>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", marginBottom: "5px" }}>
                      <span>Extracting products</span>
                      <span style={{ color: "var(--teal-bright)" }}>Done ✓</span>
                    </div>
                    <div style={{ height: "5px", background: "var(--line-dark)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: "100%", background: "var(--teal)", borderRadius: "4px" }}></div>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", marginBottom: "5px" }}>
                      <span>AI enrichment</span>
                      <span style={{ color: "var(--amber)", fontFamily: "var(--font-mono)", fontSize: "11px" }}>In progress…</span>
                    </div>
                    <div style={{ height: "5px", background: "var(--line-dark)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: "68%", background: "var(--amber)", borderRadius: "4px" }}></div>
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", marginBottom: "5px", color: "var(--ink-soft)" }}>
                      <span>Building knowledge</span>
                      <span>—</span>
                    </div>
                    <div style={{ height: "5px", background: "var(--line-dark)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: "0%", background: "var(--teal)", borderRadius: "4px" }}></div>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: "16px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--teal-bright)" }}>
                  24 products found so far…
                </div>
              </div>
              <p className="preview-note">Import runs in the background — you can continue setup while it processes.</p>
            </div>
          )}

          {/* Step 5 preview: AI tone greeting */}
          {currentStep === 5 && (
            <div id="preview-5">
              <div className="preview-widget">
                <div className="pw-head" style={{ background: "var(--ink)" }}>
                  <div className="pw-avatar">{aiName ? aiName[0] : "L"}</div>
                  <div>
                    <div className="pw-name" style={{ color: "#fff" }}>
                      {aiName || "Lumi"}
                    </div>
                    <div className="pw-status">
                      <span className="pw-dot"></span> Active now
                    </div>
                  </div>
                </div>
                <div className="pw-body">
                  <div className="pw-bubble">{greeting}</div>
                </div>
              </div>
              <p className="preview-note">Your AI's greeting updates in real time as you choose a tone.</p>
            </div>
          )}

          {/* Step 6 preview: go-live */}
          {currentStep === 6 && (
            <div id="preview-6">
              <div style={{ background: "var(--paper-raised)", border: "1px solid var(--line-dark)", borderRadius: "var(--radius-lg)", padding: "20px", textAlign: "center" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>🚀</div>
                <div className="display" style={{ fontSize: "22px", color: "var(--panel)", marginBottom: "8px" }}>Ready to go live</div>
                <div style={{ fontSize: "13px", color: "var(--ink-soft)", lineHeight: 1.5 }}>
                  Once installed, your AI counter starts engaging visitors immediately — 24/7, across every connected channel.
                </div>
                <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-around" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "22px" }}>{channels.length}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--ink-soft)", textTransform: "uppercase" }}>
                      Channels
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "22px" }}>24</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--ink-soft)", textTransform: "uppercase" }}>
                      Products
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "22px" }}>24/7</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--ink-soft)", textTransform: "uppercase" }}>
                      AI uptime
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </aside>

      </div>
    </div>
  );
}
