"use client";
import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import AdminSidebar from "@/components/admin/AdminSidebar";
import "./admin.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (loading) return;
    if (!user && !isLoginPage) {
      router.replace("/admin/login");
    }
  }, [user, loading, isLoginPage, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#0a0a0a", color: "#888" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>Authenticating...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="admin-shell">
      <AdminSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <div className="admin-breadcrumb">
              <span className="admin-bc-dot"></span>
              <span>Midevela Console</span>
            </div>
          </div>
          <div className="admin-topbar-right">
            <button className="admin-topbar-btn" title="Notifications">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </button>
          </div>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
