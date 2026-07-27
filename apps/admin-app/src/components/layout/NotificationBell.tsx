"use client";

import { Tooltip } from "@/components/ui/Tooltip";

export function NotificationBell() {
  return (
    <Tooltip content="Coming soon">
      <button
        className="relative p-2 rounded-lg text-ink-soft hover:text-ink hover:bg-black/[0.04] transition-all opacity-60 cursor-default"
        aria-label="Notifications"
        disabled
      >
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rust" />
      </button>
    </Tooltip>
  );
}
