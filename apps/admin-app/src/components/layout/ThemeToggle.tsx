"use client";

import { useTheme } from "@/lib/contexts/ThemeContext";
import { Tooltip } from "@/components/ui/Tooltip";

export function ThemeToggle() {
  const { toggle, theme } = useTheme();

  return (
    <Tooltip content={theme === "light" ? "Dark mode" : "Light mode"}>
      <button
        onClick={toggle}
        className="p-2 rounded-lg text-ink-soft hover:text-ink hover:bg-black/[0.04] transition-all"
        aria-label="Toggle theme"
      >
        {theme === "light" ? (
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 12.79A9 9 0 1111.21 3A7 7 0 0021 12.8z" />
          </svg>
        ) : (
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        )}
      </button>
    </Tooltip>
  );
}
