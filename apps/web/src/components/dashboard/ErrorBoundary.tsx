"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  resetKey?: string | number;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error inside Dashboard:", error, errorInfo);
  }

  public componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && (prevProps.resetKey !== this.props.resetKey || prevProps.children !== this.props.children)) {
      this.setState({ hasError: false });
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex",
          minHeight: "100vh",
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
            Midevela encountered an unexpected UI render error. Try resetting the view or reloading your workspace page.
          </p>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="btn btn-secondary btn-md"
              style={{ border: "2px solid var(--muted)", background: "transparent", color: "var(--white)", cursor: "pointer", padding: "8px 16px" }}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary btn-md"
              style={{ border: "2px solid var(--ink)", background: "var(--ink)", color: "var(--paper)", cursor: "pointer", padding: "8px 16px" }}
            >
              Reload Workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
