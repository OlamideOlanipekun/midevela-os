"use client";

import React from "react";
import "./handoff.css";

const SAMPLE_RULES = [
  { id: 1, condition: "AI confidence drops below 40%", action: "Escalate to human agent", priority: "High", enabled: true },
  { id: 2, condition: "Customer asks for human 3+ times", action: "Flag for manual takeover", priority: "Medium", enabled: true },
  { id: 3, condition: "Conversation exceeds 20 messages", action: "Suggest handoff to available agent", priority: "Low", enabled: false },
];

export default function HandoffPage() {
  return (
    <div>
      <div className="ho-page-head">
        <div className="eyebrow"><span className="dot"></span> INTELLIGENCE</div>
        <h1>Human Handoff</h1>
        <p className="ho-subtitle">Define when and how conversations get escalated from the AI to your human team.</p>
      </div>

      <div className="ho-banner">
        <strong>Coming soon</strong>
        <p>Human handoff rules aren&apos;t built yet. When a conversation meets a condition below, it will be flagged for manual takeover by an available team member. This preview shows the kinds of rules you&apos;ll be able to configure.</p>
      </div>

      <div className="ho-rules">
        {SAMPLE_RULES.map((rule) => (
          <div key={rule.id} className="ho-rule">
            <div className="ho-rule-head">
              <div className={`ho-rule-toggle ${rule.enabled ? "on" : "off"}`}>
                <div className="ho-toggle-knob"></div>
              </div>
              <div className="ho-rule-info">
                <div className="ho-condition">{rule.condition}</div>
                <div className="ho-action">{rule.action}</div>
              </div>
            </div>
            <span className={`ho-priority ho-priority-${rule.priority.toLowerCase()}`}>{rule.priority}</span>
          </div>
        ))}
      </div>

      <div className="ho-settings-card">
        <h3>Default behaviour</h3>
        <div className="ho-settings-row">
          <div>
            <strong>Hours of operation</strong>
            <span>During business hours, handoffs go to online team members first. After hours, they&apos;re queued for the next business day.</span>
          </div>
        </div>
        <div className="ho-settings-row">
          <div>
            <strong>Notification channel</strong>
            <span>Handoff notifications will be sent to your workspace. Email and Slack integrations are coming in a future update.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
