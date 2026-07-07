"use client";

import React, { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard render error caught:", error);
  }, [error]);

  return (
    <div style={{
      display: "flex",
      minHeight: "80vh",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg)",
      color: "var(--white)",
      fontFamily: "var(--font-mono)",
      padding: "24px",
      textAlign: "center"
    }}>
      <span style={{ fontSize: "3rem" }}>⚠️</span>
      <h2 style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: "32px", margin: "16px 0 8px" }}>Something went wrong</h2>
      <p style={{ color: "var(--muted)", maxWidth: "400px", fontSize: "14px", lineHeight: "1.5", margin: "0 0 24px" }}>
        Midevela encountered an unexpected UI render error. Try refreshing your workspace page.
      </p>
      <button
        onClick={() => reset()}
        className="btn btn-primary btn-md"
        style={{ border: "2px solid var(--ink)", background: "var(--ink)", color: "var(--paper)", cursor: "pointer", padding: "8px 16px" }}
      >
        Reload View
      </button>
    </div>
  );
}
