"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "./widget.css";

export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isAppearance = pathname.includes("/appearance");

  return (
    <div className="wg-layout-container">
      <nav className="wg-tabs">
        <Link
          href="/dashboard/widget"
          className={`wg-tab ${!isAppearance ? "active" : ""}`}
        >
          General & Code
        </Link>
        <Link
          href="/dashboard/widget/appearance"
          className={`wg-tab ${isAppearance ? "active" : ""}`}
        >
          Appearance & Styling
        </Link>
      </nav>
      <div className="wg-tab-content">{children}</div>
    </div>
  );
}
