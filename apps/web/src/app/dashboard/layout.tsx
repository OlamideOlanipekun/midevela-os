"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SubscriptionProvider, useSubscription } from "@/components/providers/SubscriptionProvider";
import Sidebar from "@/components/dashboard/Sidebar";
import TopBar from "@/components/dashboard/TopBar";
import AskAIModal from "@/components/dashboard/AskAIModal";
import "./dashboard.css";

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { subscription, loading, isReadOnly, isLocked } = useSubscription();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isBillingPage = pathname === "/dashboard/billing";

  useEffect(() => {
    if (!loading && isLocked && !isBillingPage) {
      router.replace("/dashboard/billing");
    }
  }, [loading, isLocked, isBillingPage, router]);

  if (loading) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "var(--panel)", color: "var(--paper)" }}>
        <div className="mono">Checking subscription status...</div>
      </div>
    );
  }

  // Hide dashboard contents if they are locked and undergoing redirect to billing page
  if (isLocked && !isBillingPage) {
    return null;
  }

  return (
    <div className={`dashboard-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="dashboard-main">
        {/* Hard lockout banner for inactive subscriptions */}
        {isLocked && isBillingPage && (
          <div style={{ background: "var(--rust)", color: "#fff", padding: "12px 24px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: "bold", borderBottom: "1px solid var(--line-dark)" }}>
            ⚠️ SUBSCRIPTION INACTIVE: Access to Midevela is locked. Please update your billing details below to restore access.
          </div>
        )}

        {/* Read-only grace period banner for past_due subscriptions */}
        {isReadOnly && (
          <div style={{ background: "var(--rust)", color: "#fff", padding: "12px 24px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "13px", borderBottom: "1px solid var(--line-dark)" }}>
            ⚠️ PAYMENT PAST DUE: Your last payment failed. Read-only mode activated. You have {subscription?.gracePeriodDaysRemaining} days remaining to update payment before lockout. <a href="/dashboard/billing" style={{ textDecoration: "underline", fontWeight: "bold", marginLeft: "6px" }}>Update billing →</a>
          </div>
        )}

        <TopBar
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        <main className="dashboard-content">
          {children}
        </main>
      </div>
      <AskAIModal />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SubscriptionProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SubscriptionProvider>
  );
}
