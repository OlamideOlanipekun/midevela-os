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

// UI channel code → canonical channel name stored on the org.
const CHANNEL_NAMES: Record<string, string> = { web: "website", wa: "whatsapp", ig: "instagram", fb: "facebook" };
// Only Website is actually built today; the rest are honestly "coming soon".
const LIVE_CHANNELS = new Set(["web"]);

// Minimal, dependency-free CSV parser. Handles quoted fields, embedded
// commas, and escaped double-quotes ("") — enough for exported catalogs.
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((f) => f.trim() !== "")) rows.push(row); }
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] ?? "").trim(); });
    return obj;
  });
}

interface AddedProduct { name: string; price: string; category: string }
interface ImportResult { imported: number; skipped: { row: number; name: string; reason: string }[]; warnings: { row: number; name: string; reason: string }[] }

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(2);
  const [loading, setLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [embedCode, setEmbedCode] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState<string | null>(null);
  const [orgReady, setOrgReady] = useState(false);

  // Form states
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("Fashion & Retail");
  const [sellsDesc, setSellsDesc] = useState("");
  const [openingTime, setOpeningTime] = useState("10:00 AM");
  const [closingTime, setClosingTime] = useState("8:00 PM");
  const [currency, setCurrency] = useState("Nigerian Naira (₦)");

  // Channels — default to Website (the only channel that actually works today).
  const [channels, setChannels] = useState<string[]>(["web"]);
  const [waNumber, setWaNumber] = useState("");

  // Catalog
  const [catalogSource, setCatalogSource] = useState("manual");
  const [websiteUrl, setWebsiteUrl] = useState("");

  // Real catalog progress
  const [addedProducts, setAddedProducts] = useState<AddedProduct[]>([]);
  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualCategory, setManualCategory] = useState("");
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogMsg, setCatalogMsg] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [waitlisted, setWaitlisted] = useState(false);
  const [servicesOnlyAck, setServicesOnlyAck] = useState(false);

  // AI voice
  const [aiName, setAiName] = useState("Lumi");
  const [selectedTone, setSelectedTone] = useState("Friendly & warm");
  const [neverSay, setNeverSay] = useState("");
  const [greeting, setGreeting] = useState("Hey! 👋 Welcome to Lumina Beauty Co.. What are you looking for today?");

  // Readiness (step 6)
  const [readiness, setReadiness] = useState<any>(null);

  // Update live preview values when states change
  useEffect(() => {
    const greetingText = toneGreetings[selectedTone] || toneGreetings["Friendly & warm"];
    const biz = businessName || "Lumina Beauty Co.";
    setGreeting(greetingText.replace(/LuxeStyle/g, biz));
  }, [selectedTone, businessName]);

  const handleToggleChannel = (ch: string) => {
    if (!LIVE_CHANNELS.has(ch)) return; // coming-soon channels aren't selectable
    setChannels(channels.includes(ch) ? channels.filter((c) => c !== ch) : [...channels, ch]);
  };

  const handleCopySnippet = () => {
    if (!embedCode) return;
    navigator.clipboard.writeText(embedCode);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const currencyCode = (label: string) => {
    if (label.includes("Naira")) return "NGN";
    if (label.includes("Dollar")) return "USD";
    if (label.includes("Pound")) return "GBP";
    if (label.includes("Cedi")) return "GHS";
    return "NGN";
  };

  // Creates/updates the org (idempotent server-side) and captures the real
  // widget key + embed snippet. Called early (leaving step 2) so catalog
  // operations in step 4 have an org to attach to, and again at the end.
  const completeOnboarding = async (): Promise<boolean> => {
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          website: websiteUrl.trim(),
          industry,
          currency: currencyCode(currency),
          aiName,
          tone: selectedTone.toLowerCase().replace(/\s*&\s*/g, " ").split(" ")[0],
          greeting,
          neverSay,
          channels: channels.map((c) => CHANNEL_NAMES[c] ?? c),
          whatsappNumber: waNumber,
          sellsDescription: sellsDesc,
          businessHours: { open: openingTime, close: closingTime },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not save your setup. Please try again.");
        return false;
      }
      const data = await res.json();
      if (data.embedSnippet) setEmbedCode(data.embedSnippet);
      if (data.widgetPublicKey) setWidgetKey(data.widgetPublicKey);
      setOrgReady(true);
      return true;
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
      alert("Could not save your setup. Check your connection and try again.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Ensure the org exists before any catalog operation.
  const ensureOrg = async (): Promise<boolean> => (orgReady ? true : completeOnboarding());

  const addManualProduct = async () => {
    const name = manualName.trim();
    const price = manualPrice.trim();
    if (!name || !price) { setCatalogMsg("Enter a product name and price."); return; }
    setCatalogBusy(true);
    setCatalogMsg(null);
    try {
      if (!(await ensureOrg())) { setCatalogBusy(false); return; }
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, price, category: manualCategory.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setCatalogMsg(d.error || "Couldn't add that product.");
      } else {
        setAddedProducts((prev) => [{ name, price, category: manualCategory.trim() }, ...prev]);
        setManualName(""); setManualPrice(""); setManualCategory("");
      }
    } finally {
      setCatalogBusy(false);
    }
  };

  const handleCsvFile = async (file: File) => {
    setCatalogBusy(true);
    setCatalogMsg(null);
    setImportResult(null);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) { setCatalogMsg("Couldn't read any rows — check the file has a header row and data."); return; }
      if (!(await ensureOrg())) return;
      const res = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setCatalogMsg(data.error || "Import failed."); return; }
      setImportResult(data);
      if (data.imported > 0) {
        setAddedProducts((prev) => [
          ...Array.from({ length: data.imported }, () => ({ name: "(imported)", price: "", category: "" })),
          ...prev,
        ]);
      }
    } catch {
      setCatalogMsg("Couldn't read that file.");
    } finally {
      setCatalogBusy(false);
    }
  };

  const startCrawl = async () => {
    const url = websiteUrl.trim();
    if (!url) { setCatalogMsg("Enter your website URL first."); return; }
    setCatalogBusy(true);
    setCatalogMsg(null);
    try {
      if (!(await ensureOrg())) return;
      const res = await fetch("/api/workspace/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setCatalogMsg(data.error || "Crawl failed. Try CSV or manual instead."); return; }
      const found = data.productsFoundCount ?? 0;
      if (found > 0) {
        setCatalogMsg(`Found ${found} product${found === 1 ? "" : "s"} on your site.`);
        setAddedProducts((prev) => [...Array.from({ length: found }, () => ({ name: "(crawled)", price: "", category: "" })), ...prev]);
      } else {
        setCatalogMsg("We couldn't find structured product data on your site (many sites don't publish it). Try CSV upload or add products manually — both work in seconds.");
      }
    } finally {
      setCatalogBusy(false);
    }
  };

  const fetchReadiness = async () => {
    try {
      const res = await fetch("/api/health/readiness");
      if (res.ok) setReadiness(await res.json());
    } catch { /* non-blocking */ }
  };

  const productCount = readiness?.counts?.products ?? addedProducts.length;

  const handleLaunch = async () => {
    if (!orgReady) {
      const ok = await completeOnboarding();
      if (!ok) return;
    }
    router.push("/dashboard");
  };

  const handleSkip = async () => {
    if (await completeOnboarding()) { setCurrentStep(6); fetchReadiness(); }
  };

  const handleNext = async () => {
    // Leaving business info — create the org now so steps 4/6 have one.
    if (currentStep === 2) {
      if (!businessName.trim()) { alert("Please enter your business name."); return; }
      if (!(await ensureOrg())) return;
      setCurrentStep(3);
      return;
    }
    if (currentStep === 5) {
      // Persist final voice/settings + refresh readiness for the install step.
      if (await completeOnboarding()) { setCurrentStep(6); fetchReadiness(); }
      return;
    }
    if (currentStep < 6) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 2) setCurrentStep(currentStep - 1);
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
                  className={`channel-card website ${channels.includes("web") ? "selected" : ""}`}
                  onClick={() => handleToggleChannel("web")}
                >
                  <div className="ch-icon">🌐</div>
                  <div className="ch-name">Website widget</div>
                  <div className="ch-desc">Embed on your site in one line — live now</div>
                </div>
                {[
                  { code: "wa", icon: "💬", name: "WhatsApp", desc: "Most used in Nigeria" },
                  { code: "ig", icon: "📸", name: "Instagram DMs", desc: "Auto-reply to enquiries" },
                  { code: "fb", icon: "👍", name: "Facebook Messenger", desc: "Page DMs & ad clicks" },
                ].map((ch) => (
                  <div key={ch.code} className="channel-card" style={{ opacity: 0.6, cursor: "not-allowed", position: "relative" }}>
                    <span style={{ position: "absolute", top: 10, right: 10, fontSize: 9, fontFamily: "var(--font-mono)", textTransform: "uppercase", background: "var(--paper-raised)", border: "1px solid var(--line)", borderRadius: 100, padding: "2px 7px", color: "var(--ink-soft)" }}>
                      Coming soon
                    </span>
                    <div className="ch-icon">{ch.icon}</div>
                    <div className="ch-name">{ch.name}</div>
                    <div className="ch-desc">{ch.desc}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: "var(--paper-raised)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: "14px 16px", fontSize: "13px", color: "var(--ink-soft)", lineHeight: 1.5, marginTop: 4 }}>
                Your website widget is live and included. WhatsApp, Instagram, and Facebook are in active development —
                you can add them from your dashboard the moment they ship.
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
                <div className={`catalog-card ${catalogSource === "manual" ? "selected" : ""}`} onClick={() => setCatalogSource("manual")}>
                  <div className="cat-ico">✏️</div>
                  <div>
                    <div className="cat-name">Add manually</div>
                    <div className="cat-desc">Enter products one by one — great for small stores</div>
                  </div>
                </div>
                <div className={`catalog-card ${catalogSource === "csv" ? "selected" : ""}`} onClick={() => setCatalogSource("csv")}>
                  <div className="cat-ico">CSV</div>
                  <div>
                    <div className="cat-name">Upload CSV or Excel</div>
                    <div className="cat-desc">Import a spreadsheet of your products</div>
                  </div>
                </div>
                <div className={`catalog-card ${catalogSource === "crawl" ? "selected" : ""}`} onClick={() => setCatalogSource("crawl")}>
                  <div className="cat-ico">🌐</div>
                  <div>
                    <div className="cat-name">Crawl my website</div>
                    <div className="cat-desc">Works if your site publishes structured product data</div>
                  </div>
                </div>
                <div className={`catalog-card ${catalogSource === "shopify" ? "selected" : ""}`} onClick={() => setCatalogSource("shopify")} style={{ position: "relative" }}>
                  <span style={{ position: "absolute", top: 8, right: 8, fontSize: 9, fontFamily: "var(--font-mono)", textTransform: "uppercase", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 100, padding: "2px 6px", color: "var(--ink-soft)" }}>Soon</span>
                  <div className="cat-ico">📦</div>
                  <div>
                    <div className="cat-name">Shopify / WooCommerce</div>
                    <div className="cat-desc">One-click store sync — coming soon</div>
                  </div>
                </div>
              </div>

              {catalogSource === "manual" && (
                <div className="field animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <label>Quick add a product</label>
                  <div className="field-row" style={{ margin: 0 }}>
                    <input type="text" className="input" placeholder="Product name" value={manualName} onChange={(e) => setManualName(e.target.value)} />
                    <input type="text" className="input" placeholder="Price (e.g. 25000)" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addManualProduct(); }} />
                  </div>
                  <div className="field-row" style={{ margin: 0 }}>
                    <input type="text" className="input" placeholder="Category (optional, e.g. Laptops)" value={manualCategory} onChange={(e) => setManualCategory(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addManualProduct(); }} />
                    <button type="button" className="btn-next" style={{ height: "auto", margin: 0, padding: "0 20px" }} disabled={catalogBusy} onClick={addManualProduct}>
                      {catalogBusy ? "Adding…" : "+ Add"}
                    </button>
                  </div>
                </div>
              )}

              {catalogSource === "csv" && (
                <div className="field animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <label htmlFor="ob-csv">Upload a CSV of your products</label>
                  <input id="ob-csv" type="file" accept=".csv,text/csv" disabled={catalogBusy}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); }} />
                  <a href="/midevela-product-template.csv" download style={{ fontSize: 12.5, color: "var(--teal)", fontWeight: 600 }}>↓ Download the starter template</a>
                  {importResult && (
                    <div style={{ background: "var(--paper-raised)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: 14, fontSize: 13 }}>
                      <b>{importResult.imported} imported</b>
                      {importResult.skipped.length > 0 && <> · {importResult.skipped.length} skipped</>}
                      {importResult.warnings.length > 0 && <> · {importResult.warnings.length} warning{importResult.warnings.length === 1 ? "" : "s"}</>}
                      {[...importResult.skipped.map((s) => ({ ...s, kind: "Skipped" })), ...importResult.warnings.map((w) => ({ ...w, kind: "Warning" }))].slice(0, 8).map((r, i) => (
                        <div key={i} style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 6 }}>Row {r.row} · {r.name || "—"}: {r.kind} — {r.reason}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {catalogSource === "crawl" && (
                <div className="field animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <label htmlFor="ob-crawl-url">Your website URL</label>
                  <div className="field-row" style={{ margin: 0 }}>
                    <input type="url" id="ob-crawl-url" placeholder="https://yourbusiness.com" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} style={{ flex: 1 }} />
                    <button type="button" className="btn-next" style={{ height: "auto", margin: 0, padding: "0 20px" }} disabled={catalogBusy} onClick={startCrawl}>
                      {catalogBusy ? "Scanning…" : "Scan site"}
                    </button>
                  </div>
                </div>
              )}

              {catalogSource === "shopify" && (
                <div className="field animate-fade-up" style={{ background: "var(--paper-raised)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: 16, fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.5 }}>
                  Shopify & WooCommerce sync is in development. {waitlisted ? <b style={{ color: "var(--teal)" }}>You&apos;re on the waitlist — we&apos;ll email you when it&apos;s ready.</b> : <button type="button" onClick={() => setWaitlisted(true)} style={{ background: "none", border: "none", color: "var(--teal)", fontWeight: 600, cursor: "pointer", padding: 0 }}>Join the waitlist →</button>} In the meantime, CSV import brings a full store in seconds.
                </div>
              )}

              {catalogMsg && (
                <div style={{ fontSize: 13, color: "var(--ink-soft)", background: "var(--paper-raised)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: "12px 14px", lineHeight: 1.5 }}>{catalogMsg}</div>
              )}

              {addedProducts.length > 0 && (
                <div style={{ background: "#E7F3F0", border: "1px solid var(--teal)", borderRadius: "var(--radius-md)", padding: "12px 16px", fontSize: 13.5 }}>
                  ✅ <b>{addedProducts.length} product{addedProducts.length === 1 ? "" : "s"}</b> in your catalog so far.
                  {addedProducts.filter((p) => p.name !== "(imported)" && p.name !== "(crawled)").slice(0, 5).map((p, i) => (
                    <span key={i} style={{ display: "inline-block", background: "#fff", border: "1px solid var(--line)", borderRadius: 100, padding: "2px 10px", fontSize: 12, margin: "6px 6px 0 0" }}>{p.name}{p.price ? ` · ₦${p.price}` : ""}</span>
                  ))}
                </div>
              )}

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
                <code>{embedCode ?? "Generating your embed code…"}</code>
              </div>

              <div className="install-options">
                <a
                  className="install-btn"
                  href={`mailto:?subject=${encodeURIComponent("Install our Midevela AI assistant")}&body=${encodeURIComponent(`Please paste this snippet before the closing </body> tag on our website:\n\n${embedCode ?? ""}`)}`}
                >
                  📧 Email snippet to my developer
                </a>
              </div>

              {/* AI Readiness — real signals, no fabricated stats */}
              {readiness && (
                <div style={{ marginTop: "24px", background: "#fff", border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>AI readiness</div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: readiness.ready ? "var(--teal)" : "var(--amber)" }}>{readiness.score}%</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {readiness.items.map((it: any) => (
                      <div key={it.key} style={{ display: "flex", gap: 10, fontSize: 13, alignItems: "flex-start" }}>
                        <span>{it.status === "pass" ? "✅" : it.status === "warn" ? "⚠️" : "⛔"}</span>
                        <span><b>{it.label}</b> <span style={{ color: "var(--ink-soft)" }}>— {it.detail}</span></span>
                      </div>
                    ))}
                  </div>
                  {productCount === 0 && (
                    <div style={{ marginTop: 12, fontSize: 13, color: "var(--rust)" }}>
                      Your catalog is empty — add at least one product before going live.{" "}
                      <button type="button" onClick={() => setCurrentStep(4)} style={{ background: "none", border: "none", color: "var(--teal)", fontWeight: 600, cursor: "pointer", padding: 0 }}>Add products →</button>
                    </div>
                  )}
                </div>
              )}

              {productCount === 0 && (
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "var(--ink-soft)", cursor: "pointer" }}>
                  <input type="checkbox" checked={servicesOnlyAck} onChange={(e) => setServicesOnlyAck(e.target.checked)} style={{ marginTop: 2 }} />
                  <span>I run a services business with no product catalog to add right now — let me launch anyway. (You can add products anytime from the dashboard.)</span>
                </label>
              )}

              <div className="step-nav">
                <button className="btn-back" onClick={handleBack}>
                  ← Back
                </button>
                <button
                  className="btn-next teal"
                  onClick={handleLaunch}
                  disabled={loading || (productCount === 0 && !servicesOnlyAck)}
                  title={productCount === 0 && !servicesOnlyAck ? "Add at least one product, or check the box above" : ""}
                >
                  {loading ? "Launching..." : productCount === 0 && !servicesOnlyAck ? "Add a product to launch" : "🚀 Launch my counter →"}
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

          {/* Step 4 preview: real catalog count */}
          {currentStep === 4 && (
            <div id="preview-4">
              <div style={{ background: "var(--paper-raised)", border: "1px solid var(--line-dark)", borderRadius: "var(--radius-lg)", padding: "18px", textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#5E7268", marginBottom: "14px" }}>
                  Your catalog
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 44, lineHeight: 1, color: addedProducts.length > 0 ? "var(--teal)" : "var(--ink-soft)" }}>
                  {addedProducts.length}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 6 }}>
                  {addedProducts.length === 0 ? "products added yet" : `product${addedProducts.length === 1 ? "" : "s"} in your AI catalog`}
                </div>
              </div>
              <p className="preview-note">
                {addedProducts.length === 0
                  ? "Add at least one product — the AI can only recommend what's in your catalog."
                  : "Each product is instantly indexed so the AI can recommend it. Add more, or continue."}
              </p>
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

          {/* Step 6 preview: real widget test + real stats */}
          {currentStep === 6 && (
            <div id="preview-6">
              <div style={{ background: "var(--paper-raised)", border: "1px solid var(--line-dark)", borderRadius: "var(--radius-lg)", padding: "20px", textAlign: "center" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>🚀</div>
                <div className="display" style={{ fontSize: "22px", color: "var(--panel)", marginBottom: "8px" }}>Ready to go live</div>
                <div style={{ fontSize: "13px", color: "var(--ink-soft)", lineHeight: 1.5 }}>
                  Try your AI below — this is the exact widget your customers will see.
                </div>
                <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-around" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "22px" }}>{channels.length}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--ink-soft)", textTransform: "uppercase" }}>Channels</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "22px" }}>{productCount}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--ink-soft)", textTransform: "uppercase" }}>Products</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "22px" }}>{readiness ? `${readiness.score}%` : "—"}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--ink-soft)", textTransform: "uppercase" }}>AI ready</div>
                  </div>
                </div>
              </div>

              {widgetKey && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 8, fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
                    Test your assistant — click the chat button below
                  </div>
                  <div style={{ border: "1px solid var(--line-dark)", borderRadius: "var(--radius-lg)", overflow: "hidden", height: 420, background: "#fff" }}>
                    <iframe
                      src={`/widget-preview?key=${encodeURIComponent(widgetKey)}`}
                      title="Widget preview"
                      style={{ width: "100%", height: "100%", border: "none" }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

        </aside>

      </div>
    </div>
  );
}
