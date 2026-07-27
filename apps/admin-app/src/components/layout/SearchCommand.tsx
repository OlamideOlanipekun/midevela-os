"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Tooltip } from "@/components/ui/Tooltip";

const commands = [
  { label: "Go to Mission Control", href: "/" },
  { label: "Go to Merchants", href: "/merchants" },
  { label: "Go to Conversations", href: "/conversations" },
  { label: "Go to Analytics", href: "/analytics" },
  { label: "Go to Settings", href: "/settings" },
  { label: "Go to Website Registry", href: "/websites" },
  { label: "Go to AI Operations", href: "/ai-operations" },
  { label: "Go to Knowledge", href: "/knowledge" },
];

export function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
    }
  }, [open]);

  const filtered = query
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <Tooltip content="Search (⌘K)">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-white text-ink-soft hover:text-ink hover:border-ink/20 transition-all text-sm min-w-[180px]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="flex-1 text-left">Search…</span>
          <span className="text-[10px] font-mono text-ink-soft/50 bg-black/5 px-1.5 py-0.5 rounded">⌘K</span>
        </button>
      </Tooltip>

      {open && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/30" onClick={() => setOpen(false)} />
          <div className="fixed top-[15%] left-1/2 -translate-x-1/2 z-[71] w-full max-w-lg bg-paper-raised border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <svg className="w-4 h-4 text-ink-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                placeholder="Search pages…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/60"
              />
              <span className="text-[10px] font-mono text-ink-soft/40">ESC</span>
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-ink-soft">No results.</div>
              ) : (
                filtered.map((cmd) => (
                  <button
                    key={cmd.href}
                    onClick={() => handleSelect(cmd.href)}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-ink hover:bg-black/[0.04] transition-colors"
                  >
                    {cmd.label}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
