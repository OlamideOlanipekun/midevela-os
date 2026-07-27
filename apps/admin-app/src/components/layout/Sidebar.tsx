"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  active?: boolean;
  comingSoon?: boolean;
}

const mainNav: NavItem[] = [
  { label: "Mission Control", href: "/", icon: "layout-dashboard" },
  { label: "Merchants", href: "/merchants", icon: "store" },
  { label: "Website Registry", href: "/websites", icon: "globe" },
  { label: "Conversations", href: "/conversations", icon: "message-square" },
  { label: "AI Operations", href: "/ai-operations", icon: "bot" },
  { label: "Knowledge", href: "/knowledge", icon: "book-open" },
  { label: "Analytics", href: "/analytics", icon: "bar-chart-3" },
  { label: "Queue Monitor", href: "/queue", icon: "list" },
  { label: "Billing", href: "/billing", icon: "credit-card" },
  { label: "Alerts", href: "/alerts", icon: "bell" },
  { label: "Audit", href: "/audit", icon: "shield" },
  { label: "Support", href: "/support", icon: "headphones" },
  { label: "Settings", href: "/settings", icon: "settings" },
  { label: "Infrastructure", href: "/infra", icon: "server" },
  { label: "Hardening", href: "/hardening", icon: "lock" },
  { label: "AI Observability", href: "/observability", icon: "eye" },
];

const comingSoonItems = new Set<string>();

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    "layout-dashboard": <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="4" rx="1" /><rect x="14" y="10" width="7" height="11" rx="1" /><rect x="3" y="13" width="7" height="8" rx="1" /></>,
    "store": <><path d="M3 9l2-7h14l2 7" /><path d="M9 9V5" /><path d="M15 9V5" /><rect x="3" y="9" width="18" height="12" rx="2" /><path d="M9 15h6" /></>,
    "globe": <><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15 15 0 010 20" /></>,
    "message-square": <><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></>,
    "bot": <><rect x="3" y="10" width="18" height="11" rx="2" /><circle cx="8.5" cy="13.5" r="1.5" /><circle cx="15.5" cy="13.5" r="1.5" /><path d="M10 17c.67.67 1.33 1 2 1s1.33-.33 2-1" /><path d="M9 3L7 7" /><path d="M15 3l2 4" /></>,
    "book-open": <><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></>,
    "bar-chart-3": <><path d="M3 20h18" /><path d="M5 16V8" /><path d="M10 16V5" /><path d="M15 16v-5" /><path d="M20 16V3" /></>,
    "list": <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>,
    "credit-card": <><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></>,
    "bell": <><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></>,
    "shield": <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>,
    "headphones": <><path d="M3 18v-6a9 9 0 0118 0v6" /><rect x="3" y="14" width="5" height="6" rx="2" /><rect x="16" y="14" width="5" height="6" rx="2" /></>,
    "settings": <><circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></>,
    "server": <><rect x="3" y="4" width="18" height="5" rx="1" /><rect x="3" y="15" width="18" height="5" rx="1" /><circle cx="7" cy="6.5" r=".5" /><circle cx="7" cy="17.5" r=".5" /></>,
    "lock": <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 118 0v4" /><circle cx="12" cy="16" r="1" /></>,
    "eye": <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
  };

  return (
    <svg className="w-[18px] h-[18px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-paper-raised border-r border-border h-screen sticky top-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal flex items-center justify-center text-white font-bold text-xs">
            M
          </div>
          <span className="font-display font-bold text-lg text-ink">Midevela</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {mainNav.map((item) => {
          const isActive = pathname === item.href;
          const isComingSoon = comingSoonItems.has(item.href);

          return (
            <Link
              key={item.href}
              href={isComingSoon ? "#" : item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative ${
                isActive
                  ? "bg-teal/10 text-teal-deep"
                  : "text-ink-soft hover:text-ink hover:bg-black/[0.03]"
              }`}
              onClick={isComingSoon ? (e) => e.preventDefault() : undefined}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
              {isComingSoon && (
                <span className="ml-auto text-[9px] font-mono uppercase tracking-widest text-ink-soft/50 bg-black/5 px-1.5 py-0.5 rounded">
                  Soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <div className="text-[10px] font-mono text-ink-soft/50 text-center">
          Midevela v0.1
        </div>
      </div>
    </aside>
  );
}
