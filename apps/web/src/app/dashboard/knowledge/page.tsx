"use client";

import React, { useState, useEffect } from "react";
import { useSubscription } from "@/components/providers/SubscriptionProvider";
import "./knowledge.css";

interface FAQ {
  question: string;
  answer: string;
  category: string;
  usageCount: number;
}

interface Policy {
  name: string;
  content: string;
  updatedAt: string;
}

interface DocumentItem {
  name: string;
  size: string;
  chunks: number;
  status: "Synced" | "Processing";
}

export default function KnowledgeBasePage() {
  const { isReadOnly } = useSubscription();
  const [activeTab, setActiveTab] = useState<"faq" | "policy" | "voice" | "docs">("faq");
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [newCat, setNewCat] = useState("Shipping");
  const [showAddFaq, setShowAddFaq] = useState(false);

  const [tone, setTone] = useState("friendly");
  const [greeting, setGreeting] = useState(
    "Good day! Welcome to LuxeStyle. How can I help you find the perfect outfit today?"
  );

  const [crawlUrl, setCrawlUrl] = useState("luxestyle.ng");
  const [crawlLoading, setCrawlLoading] = useState(false);
  const [crawlMessage, setCrawlMessage] = useState<string | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadKnowledgeData = () => {
    setLoading(true);
    fetch("/api/knowledge")
      .then((res) => res.json())
      .then((data) => {
        if (data.faqs) setFaqs(data.faqs);
        if (data.policies) setPolicies(data.policies);
        if (data.documents) setDocuments(data.documents);
      })
      .catch((err) => console.error("Error loading knowledge data:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadKnowledgeData();

    fetch("/api/workspace/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setTone(data.settings.tone || "friendly");
          setGreeting(data.settings.greeting || "Good day! Welcome to LuxeStyle. How can I help you find the perfect outfit today?");
        }
      })
      .catch((err) => console.error("Error loading brand settings:", err));

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "docs" || tab === "voice" || tab === "policy" || tab === "faq") {
        setActiveTab(tab as any);
      }
    }
  }, []);

  const handleStartCrawl = async () => {
    if (!crawlUrl.trim()) return;
    setCrawlLoading(true);
    setCrawlMessage("Initializing crawler (depth 0)…");

    setTimeout(() => setCrawlMessage("Scraping home page — extracting hyperlinks…"), 1200);
    setTimeout(() => setCrawlMessage("Scraping products page — parsing JSON-LD…"), 2600);
    setTimeout(() => setCrawlMessage("Saving updates to the Business Brain…"), 3800);

    try {
      const response = await fetch("/api/workspace/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: crawlUrl }),
      });
      const data = await response.json();
      if (data.success) {
        setTimeout(() => {
          setCrawlLoading(false);
          setCrawlMessage(`Crawled ${data.pagesCrawledCount} pages · imported ${data.productsFoundCount} products & ${data.policiesFoundCount} policies.`);
          loadKnowledgeData();
        }, 4200);
      } else {
        setCrawlLoading(false);
        setCrawlMessage(`Crawl failed: ${data.error || "unknown error"}`);
      }
    } catch (err) {
      setCrawlLoading(false);
      setCrawlMessage("Network error during crawl.");
    }
  };

  const handleSaveVoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/workspace/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone, greeting }),
      });
      if (res.ok) showToast("Brand voice saved.");
    } catch (err) {
      console.error("Failed to save brand voice:", err);
    }
  };

  const handleDeleteFaq = async (question: string) => {
    if (!confirm("Delete this FAQ?")) return;
    try {
      const res = await fetch(`/api/knowledge?question=${encodeURIComponent(question)}`, { method: "DELETE" });
      if (res.ok) {
        setFaqs((prev) => prev.filter((faq) => faq.question !== question));
        showToast("FAQ deleted.");
      }
    } catch (err) {
      console.error("Failed to delete FAQ:", err);
    }
  };

  const handleAddFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: newQuestion, answer: newAnswer, category: newCat }),
      });
      const data = await res.json();
      if (data.success) {
        setFaqs((prev) => [data.faq, ...prev]);
        setNewQuestion("");
        setNewAnswer("");
        setShowAddFaq(false);
        showToast("FAQ added.");
      }
    } catch (err) {
      console.error("Failed to add FAQ:", err);
    }
  };

  // Health is derived from what's actually indexed, not a fixed decorative
  // number — it used to say "124 FAQs" next to a list of 3.
  const healthScore = Math.min(
    100,
    Math.round((faqs.length * 8 + policies.length * 10 + documents.length * 6) / 2) || 0
  );

  return (
    <div>
      <div className="know-page-head">
        <div>
          <div className="eyebrow">
            <span className="dot"></span> BUSINESS BRAIN
          </div>
          <h1>Knowledge</h1>
          <div className="know-page-sub">Feed FAQs, policies, and files into the AI's decision layer.</div>
        </div>
        {activeTab === "faq" && !loading && (
          <button className="btn-dark" onClick={() => setShowAddFaq(true)} disabled={isReadOnly}>
            + Add FAQ
          </button>
        )}
      </div>

      <div className="tabs" role="tablist" style={{ marginBottom: 22 }}>
        {(["faq", "policy", "voice", "docs"] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={`tab ${activeTab === tab ? "tab-active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "faq" ? "FAQs" : tab === "policy" ? "Policies" : tab === "voice" ? "Brand Voice" : "Documents"}
          </button>
        ))}
      </div>

      <div className="know-layout">
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="know-row" style={{ height: 78, opacity: 0.5 }} />
            ))
          ) : (
            <>
              {activeTab === "faq" &&
                faqs.map((faq, i) => (
                  <div key={i} className="know-row">
                    <div className="know-row-header">
                      <span className="know-row-title">{faq.question}</span>
                      <div className="know-row-actions">
                        <span className="badge badge-muted">{faq.category}</span>
                        <span className="badge badge-green">Used {faq.usageCount}×</span>
                        <button
                          className="know-delete-btn"
                          onClick={() => handleDeleteFaq(faq.question)}
                          disabled={isReadOnly}
                          title="Delete FAQ"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <p className="know-row-body">{faq.answer}</p>
                  </div>
                ))}

              {activeTab === "policy" &&
                policies.map((p, i) => (
                  <div key={i} className="know-row">
                    <div className="know-row-header">
                      <span className="know-row-title">{p.name}</span>
                      <span className="know-row-meta">Updated {p.updatedAt}</span>
                    </div>
                    <p className="know-row-body">{p.content}</p>
                  </div>
                ))}

              {activeTab === "voice" && (
                <form onSubmit={handleSaveVoice} className="know-voice-card">
                  <fieldset disabled={isReadOnly} style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 20 }}>
                    <div className="know-voice-grid">
                      <div className="know-field">
                        <label>AI personality tone</label>
                        <select value={tone} onChange={(e) => setTone(e.target.value)}>
                          <option value="friendly">Friendly & warm (recommended)</option>
                          <option value="professional">Professional & direct</option>
                          <option value="casual">Casual & conversational</option>
                        </select>
                      </div>
                      <div className="know-field">
                        <label>Assistant voice</label>
                        <select defaultValue="standard">
                          <option value="standard">Standard English</option>
                          <option value="nigerian">Nigerian English / Pidgin-infused</option>
                        </select>
                      </div>
                    </div>
                    <div className="know-field">
                      <label>Proactive widget welcome prompt</label>
                      <textarea rows={3} value={greeting} onChange={(e) => setGreeting(e.target.value)} />
                    </div>
                    <button type="submit" className="btn-dark" style={{ alignSelf: "flex-end", padding: "12px 22px" }}>
                      Save brand voice
                    </button>
                  </fieldset>
                </form>
              )}

              {activeTab === "docs" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div className="know-uploader">
                    <span style={{ fontSize: 26 }}>📂</span>
                    <span className="know-uploader-title">Drag & drop files to train the AI</span>
                    <span className="know-uploader-sub">Supports PDF, DOCX, CSV, TXT up to 10MB</span>
                    <button className="btn-outline" style={{ marginTop: 8 }} disabled={isReadOnly}>
                      Browse files
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <span className="know-sidebar-label" style={{ textAlign: "left" }}>Synced files</span>
                    {documents.map((doc, i) => (
                      <div key={i} className="know-doc-row">
                        <div className="know-doc-info">
                          <span className="know-doc-icon">📄</span>
                          <div>
                            <div className="know-doc-name">{doc.name}</div>
                            <div className="know-doc-meta">{doc.size} · {doc.chunks} chunks parsed</div>
                          </div>
                        </div>
                        <span className="badge badge-green">{doc.status}</span>
                      </div>
                    ))}
                  </div>

                  <div className="know-crawl-card">
                    <span style={{ fontSize: 26 }}>🕸️</span>
                    <span className="know-crawl-title">Auto-ingest via website crawl</span>
                    <p className="know-crawl-desc">
                      Enter your website URL — the Knowledge Engine crawls internal pages and extracts JSON-LD products, policies, and FAQs.
                    </p>
                    <div className="know-crawl-row">
                      <input
                        type="text"
                        placeholder="https://luxestyle.ng"
                        value={crawlUrl}
                        onChange={(e) => setCrawlUrl(e.target.value)}
                        disabled={crawlLoading}
                      />
                      <button
                        className="btn-dark"
                        onClick={handleStartCrawl}
                        disabled={crawlLoading || !crawlUrl.trim() || isReadOnly}
                      >
                        {crawlLoading ? "Crawling…" : "Crawl"}
                      </button>
                    </div>
                    {crawlMessage && <div className="know-crawl-status">{crawlMessage}</div>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT: HEALTH SIDEBAR */}
        <div className="know-sidebar">
          <div>
            <span className="know-sidebar-label">AI knowledge health</span>
            <div className="know-health-value">{healthScore}%</div>
            <div className="know-health-track">
              <div className="know-health-fill" style={{ width: `${healthScore}%` }} />
            </div>
          </div>

          <div className="know-stats-list">
            <div className="know-stat-line">
              <span>FAQs indexed</span>
              <strong>{faqs.length}</strong>
            </div>
            <div className="know-stat-line">
              <span>Policies synced</span>
              <strong>{policies.length}</strong>
            </div>
            <div className="know-stat-line">
              <span>Documents parsed</span>
              <strong>{documents.length}</strong>
            </div>
          </div>

          <div className="know-gaps">
            <span className="know-sidebar-label" style={{ textAlign: "left" }}>Missing knowledge</span>
            <div className="know-gap-card">
              <span className="know-gap-title">Warranty inquiries</span>
              <span className="know-gap-desc">Customers frequently ask about warranty coverage — no FAQ covers it yet.</span>
              <button className="know-gap-action" onClick={() => { setActiveTab("faq"); setShowAddFaq(true); }}>
                + Add FAQ
              </button>
            </div>
            <div className="know-gap-card">
              <span className="know-gap-title">Returns on cosmetics</span>
              <span className="know-gap-desc">Customers ask if beauty serums can be returned — missing an exact returns FAQ.</span>
              <button className="know-gap-action" onClick={() => { setActiveTab("faq"); setShowAddFaq(true); }}>
                + Add FAQ
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ADD FAQ DRAWER */}
      {showAddFaq && (
        <>
          <div className="know-drawer-overlay" onClick={() => setShowAddFaq(false)} />
          <div className="know-drawer">
            <div className="know-drawer-header">
              <h3>Add FAQ entry</h3>
              <button className="know-drawer-close" onClick={() => setShowAddFaq(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <form onSubmit={handleAddFaq} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div className="know-field">
                <label htmlFor="faq-q">Question</label>
                <input
                  id="faq-q"
                  type="text"
                  placeholder="e.g. Do you deliver on Sundays?"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  required
                />
              </div>
              <div className="know-field">
                <label htmlFor="faq-a">Answer</label>
                <textarea
                  id="faq-a"
                  placeholder="Provide a clear, detailed answer — the AI extracts context from this to formulate responses."
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  rows={5}
                  required
                />
              </div>
              <div className="know-field">
                <label htmlFor="faq-cat">Category</label>
                <select id="faq-cat" value={newCat} onChange={(e) => setNewCat(e.target.value)}>
                  <option value="Shipping">Shipping</option>
                  <option value="Returns">Returns</option>
                  <option value="Payments">Payments</option>
                  <option value="Product Details">Product Details</option>
                  <option value="General">General</option>
                </select>
              </div>
              <button type="submit" className="btn-dark" style={{ padding: "13px 0", marginTop: 6 }}>
                Add FAQ
              </button>
            </form>
          </div>
        </>
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
