"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

export default function AdminLoginForm() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await signIn({ email, password });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Invalid credentials.");
      return;
    }
    // Check if user is super admin
    const me = await fetch("/api/auth/me").then((r) => r.json());
    if (me.user?.role !== "super_admin") {
      setError("Access denied. Super admin privileges required.");
      return;
    }
    router.push("/admin");
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="5" fill="currentColor"/></svg>
          <span>MidAdmin</span>
        </div>
        <h1 className="admin-login-title">Super Admin</h1>
        <p className="admin-login-sub">Sign in to manage the Midevela platform.</p>
        {error && <div className="admin-login-error">{error}</div>}
        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="admin-field">
            <label htmlFor="admin-email">Email</label>
            <input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@midevela.com" required autoComplete="email" />
          </div>
          <div className="admin-field">
            <label htmlFor="admin-password">Password</label>
            <input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
          </div>
          <button type="submit" className="admin-login-btn" disabled={submitting}>
            {submitting ? "Authenticating..." : "Sign in to Console"}
          </button>
        </form>
        <a href="/login" className="admin-login-back">Back to merchant dashboard</a>
      </div>
    </div>
  );
}
