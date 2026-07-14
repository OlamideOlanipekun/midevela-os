"use client";

import React from "react";
import { useAuth } from "@/components/providers/AuthProvider";

interface TopBarProps {
  onMenuToggle: () => void;
}

/**
 * Intentionally minimal. The global search, notification bell, and "Ask AI"
 * copilot that used to live here were all non-functional mock UI (a dead
 * search input, a hardcoded "unread" dot with no notifications system, and
 * a copilot that returned fabricated numbers). They were removed rather
 * than shipped as fakes; each comes back when it's real.
 */
export default function TopBar({ onMenuToggle }: TopBarProps) {
  const { user } = useAuth();

  const userName = user?.name || user?.email || "";
  const userInitials = userName ? userName[0].toUpperCase() : "O";

  return (
    <header className="topbar">
      {/* Mobile Menu Button */}
      <button className="topbar-menu-btn" onClick={onMenuToggle} aria-label="Toggle menu">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M3 5H17M3 10H17M3 15H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <div className="tb-spacer"></div>

      <div className="tb-avatar">{userInitials}</div>
    </header>
  );
}
