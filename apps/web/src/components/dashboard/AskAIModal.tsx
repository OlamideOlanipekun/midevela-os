"use client";

import React, { useEffect, useState } from "react";

/**
 * Mounted once in DashboardLayout so it's available on every dashboard
 * route. TopBar's "Ask AI" button (also global) triggers it purely via
 * the "open-ask-ai" window event rather than a prop, since TopBar and
 * this modal don't otherwise share a parent below the layout. Pass an
 * optional `detail.question` to open pre-filled (used by the dashboard
 * home page's "insight" quick actions).
 */
export default function AskAIModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ question?: string }>).detail;
      if (detail?.question) setQuestion(detail.question);
      setIsOpen(true);
    };
    window.addEventListener("open-ask-ai", handleOpen);
    return () => window.removeEventListener("open-ask-ai", handleOpen);
  }, []);

  const handleSubmit = () => {
    if (!question.trim()) return;
    setLoading(true);
    setResponse(null);

    setTimeout(() => {
      setLoading(false);
      const query = question.toLowerCase();
      if (query.includes("shipping")) {
        setResponse("Based on visitor chat analysis, 9 unique customers requested international shipping details this week. I recommend creating a shipping policy in your Knowledge Base specifying rates for West Africa (Ghana, Senegal) and Europe. Estimated conversion uplift: +3.2%.");
      } else if (query.includes("conversion") || query.includes("confidence")) {
        setResponse("Your current checkout conversion rate is 4.8%. The primary drop-off occurs immediately after shipping calculations are presented. I recommend offering free shipping above ₦50,000 to recover approximately ₦68k in lost weekly revenue.");
      } else {
        setResponse("I have analyzed your store logs. Lumina Beauty Co. is currently seeing strong organic traffic (24 active visitors). The active conversation funnel shows a 12% purchase conversion. To optimize sales further, ensure your 'ClearGlow Routine Set' features automatic upsell recommendations during visitor checkout chats.");
      }
    }, 1200);
  };

  const handleClose = () => {
    setIsOpen(false);
    setResponse(null);
    setQuestion("");
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(19, 32, 27, 0.7)",
      backdropFilter: "blur(6px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2000
    }}>
      <div style={{
        background: "var(--paper-raised)",
        border: "2px solid var(--ink)",
        borderRadius: "var(--radius-lg)",
        padding: "28px",
        width: "100%",
        maxWidth: "500px",
        boxShadow: "0 20px 50px rgba(26,24,20,0.3)",
        position: "relative"
      }}>
        <button
          onClick={handleClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "none",
            border: "none",
            fontSize: "18px",
            cursor: "pointer",
            color: "var(--ink-soft)"
          }}
        >
          ✕
        </button>

        <h3 className="display" style={{ margin: "0 0 16px", fontSize: "20px", color: "var(--ink)" }}>Midevela AI Copilot</h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <label style={{ fontFamily: "var(--font-mono)", fontSize: "11px", textTransform: "uppercase", color: "var(--ink-soft)" }}>
            What would you like to ask the commerce AI?
          </label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Type e.g., 'shipping' or 'conversion'..."
            style={{
              padding: "12px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              fontSize: "13.5px",
              fontFamily: "var(--font-body)",
              color: "var(--ink)",
              background: "#fff",
              outline: "none"
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
          />

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              background: "var(--ink)",
              color: "var(--paper)",
              border: "none",
              borderRadius: "var(--radius-pill)",
              padding: "12px",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              cursor: "pointer"
            }}
          >
            {loading ? "Consulting store logs..." : "✦ ASK AI"}
          </button>
        </div>

        {response && (
          <div style={{
            marginTop: "20px",
            padding: "14px",
            background: "#fff",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            fontSize: "13px",
            lineHeight: "1.5"
          }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--teal)", textTransform: "uppercase", marginBottom: "6px", fontWeight: "bold" }}>
              AI Response
            </div>
            <p style={{ margin: 0, color: "var(--ink)" }}>{response}</p>
          </div>
        )}
      </div>
    </div>
  );
}
