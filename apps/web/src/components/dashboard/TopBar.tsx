"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

interface TopBarProps {
  onMenuToggle: () => void;
}

export default function TopBar({ onMenuToggle }: TopBarProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [isMac, setIsMac] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);

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

      {/* Search Input Bar */}
      <div className={`tb-search ${searchFocused ? "focused" : ""}`}>
        <span className="tb-search-icon" style={{ display: "inline-flex", alignItems: "center" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          type="text"
          placeholder="Search customers, products, conversations…"
          className="tb-search-input"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
        <kbd>{isMac ? "⌘K" : "Ctrl K"}</kbd>
      </div>

      <div className="tb-spacer"></div>

      {/* Action Buttons */}
      <button
        className="tb-command"
        onClick={() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("open-ask-ai"));
          }
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6z" />
        </svg>
        <span>Ask AI</span>
      </button>
      
      <button className="tb-icon-btn" aria-label="Notifications">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <span className="dot-alert"></span>
      </button>

      <div className="tb-avatar">{userInitials}</div>
    </header>
  );
}
