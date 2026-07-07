"use client";

import React from "react";
import { useSubscription } from "@/components/providers/SubscriptionProvider";

interface PlanGateProps {
  minPlan: "starter" | "growth" | "pro";
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const TIER_ORDER = {
  starter: 0,
  growth: 1,
  pro: 2,
};

export default function PlanGate({ minPlan, children, fallback }: PlanGateProps) {
  const { subscription } = useSubscription();

  const currentPlan = subscription?.plan || "starter";
  const hasAccess = TIER_ORDER[currentPlan] >= TIER_ORDER[minPlan];

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  return (
    <div style={{
      border: "1px dashed var(--rust)",
      borderRadius: "var(--radius-md)",
      padding: "24px",
      background: "rgba(178, 58, 46, 0.04)",
      textAlign: "center",
      fontFamily: "var(--font-mono)",
      margin: "12px 0"
    }}>
      <div style={{ fontSize: "16px", marginBottom: "8px", fontWeight: "bold" }}>🔒 Feature Locked</div>
      <div style={{ fontSize: "12px", color: "var(--ink-soft)", marginBottom: "16px" }}>
        This feature requires the <span style={{ textTransform: "uppercase", fontWeight: "bold", color: "var(--rust)" }}>{minPlan}</span> plan or higher. (Current: {currentPlan})
      </div>
      <a href="/dashboard/billing" className="btn btn-primary btn-sm" style={{ display: "inline-block", textDecoration: "none" }}>
        Upgrade plan to unlock →
      </a>
    </div>
  );
}
