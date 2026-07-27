"use client";

import Link from "next/link";
import { SearchCommand } from "./SearchCommand";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

export function Header() {
  return (
    <header className="flex items-center justify-between gap-4 px-6 py-3 border-b border-border bg-paper-raised/80 backdrop-blur-sm sticky top-0 z-40">
      {/* Left: mobile logo + breadcrumb placeholder */}
      <div className="flex items-center gap-3">
        <Link href="/" className="lg:hidden flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal flex items-center justify-center text-white font-bold text-xs">
            M
          </div>
        </Link>
        <div className="hidden sm:flex items-center gap-2 text-sm text-ink-soft">
          <span className="text-ink font-medium">Mission Control</span>
        </div>
      </div>

      {/* Right: search, notifications, theme, user */}
      <div className="flex items-center gap-2">
        <SearchCommand />
        <NotificationBell />
        <ThemeToggle />
        <div className="w-px h-6 bg-border mx-1" />
        <UserMenu />
      </div>
    </header>
  );
}
