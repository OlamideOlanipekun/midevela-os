"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const Icon = ({ type }: { type: string }) => {
  switch (type) {
    case "mission":
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>;
    case "orgs":
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
    case "merchants":
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case "agents":
      return <svg width="16" height="16" viewBox="0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
    case "conversations":
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="12" y1="9" x2="16" y2="9"/><line x1="12" y1="13" x2="14" y2="13"/></svg>;
    case "products":
      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>;
    case "knowledge":       return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>;
    case "usage":           return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12"  y2="4"/><line x1="6" y1="20"  x2="6" y2="14"/></svg>;
    case "billing":         return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>;
    case "infrastructure":  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/></svg>;
    case "integrations":    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
    case "support":         return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>;
    case "moderation":      return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
    case "flags":           return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>;
    case "audit":           return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
    case "settings":        return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>;
    default: return null;
  }
};

const navItems = [
  { section: null, items: [{ label: "Mission Control", href: "/admin", icon: "mission" }] },
  { section: "Platform", items: [{ label: "Organizations", href: "/admin/organizations", icon: "orgs" }, { label: "Merchants", href: "/admin/merchants", icon: "merchants" }, { label: "AI Agents", href: "/admin/ai-agents", icon: "agents" }] },
  { section: "Monitoring", items: [{ label: "Live Conversations", href: "/admin/conversations", icon: "conversations" }, { label: "Usage", href: "/admin/usage", icon: "usage" }, { label: "Infrastructure", href: "/admin/infrastructure", icon: "infrastructure" }] },
  { section: "Data", items: [{ label: "Products", href: "/admin/products", icon: "products" }, { label: "Knowledge", href: "/admin/knowledge", icon: "knowledge" }] },
  { section: "Commerce", items: [{ label: "Billing", href: "/admin/billing", icon: "billing" }, { label: "Integrations", href: "/admin/integrations", icon: "integrations" }] },
  { section: "Operations", items: [{ label: "Feature Flags", href: "/admin/feature-flags", icon: "flags" }, { label: "Audit Logs", href: "/admin/audit-logs", icon: "audit" }, { label: "Support", href: "/admin/support", icon: "support" }, { label: "Moderation", href: "/admin/moderation", icon: "moderation" }] },
  { section: null, items: [{ label: "Settings", href: "/admin/settings", icon: "settings" }] },
];

export default function AdminSidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const userName = user?.name || user?.email || "Admin";
  const initials = userName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();

  return (
    <aside className={`admin-sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="admin-sb-top">
        <Link href="/admin" className="admin-sb-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="5" fill="currentColor"/></svg>
          {!collapsed && <span className="admin-sb-brand">MidAdmin</span>}
        </Link>
        <button className="admin-sb-toggle" onClick={onToggle} aria-label="Toggle sidebar">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
            <path d={collapsed ? "M6 3l5 5-5 5" : "M10 3l-5 5 5 5"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className="admin-sb-search" onClick={() => setSearchOpen(true)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        {!collapsed && <span className="admin-sb-search-text">Search anything...</span>}
        {!collapsed && <span className="admin-sb-search-kbd">Ctrl+K</span>}
      </div>

      <nav className="admin-sb-nav">
        {navItems.map((group, gi) => (
          <div key={gi} className={group.section ? "admin-sb-group" : "admin-sb-group no-label"}>
            {!collapsed && group.section && <div className="admin-sb-label">{group.section}</div>}
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-sb-link ${isActive(item.href) ? "active" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon type={item.icon} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="admin-sb-footer">
        <div className="admin-sb-user">
          <div className="admin-sb-avatar">{initials}</div>
          {!collapsed && <div className="admin-sb-user-info"><div className="admin-sb-user-name">{userName}</div><div className="admin-sb-user-role">Super Admin</div></div>}
        </div>
      </div>
    </aside>
  );
}
