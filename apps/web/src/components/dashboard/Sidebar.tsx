"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSubscription } from "@/components/providers/SubscriptionProvider";
import { useAuth } from "@/components/providers/AuthProvider";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const SidebarIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "dashboard":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" />
          <rect x="14" y="3" width="7" height="5" />
          <rect x="14" y="12" width="7" height="9" />
          <rect x="3" y="16" width="7" height="5" />
        </svg>
      );
    case "conversations":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "customers":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "products":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    case "categories":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "knowledge":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    case "analytics":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case "ai-performance":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "billing":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      );
    case "settings":
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    default:
      return null;
  }
};

const mainNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "Conversations", href: "/dashboard/conversations", icon: "conversations", badge: 12 },
  { label: "Customers", href: "/dashboard/customers", icon: "customers" },
  { label: "Products", href: "/dashboard/products", icon: "products" },
  { label: "Categories", href: "/dashboard/categories", icon: "categories" },
  { label: "Knowledge", href: "/dashboard/knowledge", icon: "knowledge" },
];

const intelligenceNavItems = [
  { label: "Analytics", href: "/dashboard/analytics", icon: "analytics" },
  { label: "AI Performance", href: "/dashboard/ai-performance", icon: "ai-performance" },
];

const workspaceNavItems = [
  { label: "Billing", href: "/dashboard/billing", icon: "billing" },
  { label: "Settings", href: "/dashboard/settings", icon: "settings" },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { subscription } = useSubscription();
  const { user, signOut: authSignOut } = useAuth();
  const router = useRouter();
  const signOut = async () => {
    await authSignOut();
    router.push("/login");
  };
  const [orgName, setOrgName] = useState("Lumina Beauty Co.");

  useEffect(() => {
    fetch("/api/workspace/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings?.orgName) setOrgName(data.settings.orgName);
      })
      .catch(() => {});
  }, []);

  const currentPlan = subscription?.status === "active" ? `${subscription.plan.toUpperCase()} PLAN` : "EXPIRED PLAN";

  const userName = user?.name || user?.email || "";
  const userInitials = userName
    ? userName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "O";

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const renderLink = (item: { label: string; href: string; icon: string; badge?: number }) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`sb-link ${active ? "active" : ""}`}
        onClick={onMobileClose}
      >
        <span className="ico" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}><SidebarIcon type={item.icon} /></span>
        {!collapsed && (
          <>
            <span>{item.label}</span>
            {item.badge && <span className="badge">{item.badge}</span>}
          </>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={onMobileClose} />
      )}

      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        {/* Toggle Button */}
        <button
          className="sidebar-toggle"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
            <path
              d={collapsed ? "M6 3L11 8L6 13" : "M10 3L5 8L10 13"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Logo */}
        <Link href="/dashboard" className="sb-logo">
          <Image src="/logo-mark-light.png" alt="" width={24} height={24} className="mark-img" priority />
          {!collapsed && "Midevela"}
        </Link>

        {/* Workspace Switcher Card */}
        <div className="sb-workspace">
          <div className="wk-avatar">{orgName[0]?.toUpperCase()}</div>
          {!collapsed && (
            <>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="wk-name">{orgName}</div>
                <div className="wk-plan">{currentPlan}</div>
              </div>
              <span className="wk-caret">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </>
          )}
        </div>

        {/* Main Nav */}
        <nav className="sb-nav">
          {mainNavItems.map(renderLink)}

          {!collapsed && <div className="sb-section-label">Intelligence</div>}
          {intelligenceNavItems.map(renderLink)}

          {!collapsed && <div className="sb-section-label">Workspace</div>}
          {workspaceNavItems.map(renderLink)}
        </nav>

        {/* Footer User Info */}
        <div className="sb-footer" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div className="sb-user" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "4px" }}>
            <div className="flex items-center gap-md" style={{ minWidth: 0 }}>
              <div className="u-avatar">{userInitials}</div>
              {!collapsed && (
                <div style={{ minWidth: 0 }}>
                  <div className="u-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div>
                  <div className="u-role">Owner</div>
                </div>
              )}
            </div>
            {!collapsed && (
              <button 
                onClick={signOut}
                className="btn btn-ghost btn-sm"
                title="Log out"
                style={{ padding: "4px 8px", minWidth: "auto", color: "var(--rust)", fontSize: "11px", display: "inline-flex", alignItems: "center", border: "1px solid rgba(178, 58, 46, 0.25)", borderRadius: "var(--radius-sm)", cursor: "pointer", background: "none" }}
              >
                Log out
              </button>
            )}
          </div>
          {collapsed && (
            <button 
              onClick={signOut}
              className="btn btn-ghost btn-sm"
              title="Log out"
              style={{ width: "100%", padding: "6px 0", color: "var(--rust)", fontSize: "12px", border: "none", cursor: "pointer", background: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
