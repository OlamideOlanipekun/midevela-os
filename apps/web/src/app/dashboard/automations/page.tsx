"use client";

import React from "react";
import "./automations.css";

const SAMPLE_RULES = [
  { id: 1, trigger: "Customer asks about pricing", action: "Send product catalogue card", status: "Active" },
  { id: 2, trigger: "Customer abandons cart", action: "Send recovery message with discount", status: "Active" },
  { id: 3, trigger: "Customer mentions competitor", action: "Highlight unique selling points & offer comparison", status: "Draft" },
];

export default function AutomationsPage() {
  return (
    <div>
      <div className="au-page-head">
        <div className="eyebrow"><span className="dot"></span> INTELLIGENCE</div>
        <h1>Automations</h1>
        <p className="au-subtitle">Create triggered workflows that respond to customer behaviour automatically.</p>
      </div>

      <div className="au-banner">
        <strong>Coming soon</strong>
        <p>Automations aren&apos;t built yet. Here&apos;s a preview of what&apos;s coming — condition-based triggers that fire actions like sending messages, updating customer segments, or creating follow-up tasks.</p>
      </div>

      <div className="au-list">
        {SAMPLE_RULES.map((rule) => (
          <div key={rule.id} className="au-rule">
            <div className="au-rule-left">
              <div className="au-trigger">
                <span className="au-label">When</span>
                <span>{rule.trigger}</span>
              </div>
              <div className="au-arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </div>
              <div className="au-action">
                <span className="au-label">Then</span>
                <span>{rule.action}</span>
              </div>
            </div>
            <span className={`au-status au-status-${rule.status.toLowerCase()}`}>{rule.status}</span>
          </div>
        ))}
      </div>

      <div className="au-empty">
        <p>When automations ship, you&apos;ll be able to add new rules here with custom triggers and actions.</p>
      </div>
    </div>
  );
}
