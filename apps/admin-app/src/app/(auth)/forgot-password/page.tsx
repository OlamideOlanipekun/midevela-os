"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Link href="/" className="text-xl font-bold text-ink mb-6 block">
            Midevela
          </Link>
          <h2 className="text-2xl font-display font-bold text-ink mb-1">Reset your password</h2>
          <p className="text-sm text-ink-soft">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {sent ? (
          <div className="rounded-xl border border-teal/30 bg-teal/5 p-6 text-center">
            <div className="text-3xl mb-3">📬</div>
            <p className="text-sm text-ink font-medium mb-1">Check your inbox</p>
            <p className="text-xs text-ink-soft mb-4">
              If an account exists for {email}, you&apos;ll receive a password reset link shortly.
            </p>
            <Link href="/login" className="text-teal text-sm font-medium hover:text-teal-deep transition-colors">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg border border-rust/30 bg-rust/5 px-4 py-3 text-sm text-rust">
                {error}
              </div>
            )}

            <Input
              label="Email"
              type="email"
              placeholder="admin@midevela.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Send reset link
            </Button>

            <div className="text-center">
              <Link href="/login" className="text-sm text-ink-soft hover:text-ink transition-colors">
                Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
