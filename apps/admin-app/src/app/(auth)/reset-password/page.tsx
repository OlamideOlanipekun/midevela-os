"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/Input";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (!token) {
      setError("Missing reset token. Use the link from your email.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Reset failed. The link may have expired.");
        setLoading(false);
        return;
      }

      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };

  if (done) {
    return (
      <div className="rounded-xl border border-teal/30 bg-teal/5 p-6 text-center">
        <div className="text-3xl mb-3">✅</div>
        <p className="text-sm text-ink font-medium mb-1">Password reset successful</p>
        <p className="text-xs text-ink-soft mb-4">You can now sign in with your new password.</p>
        <Link href="/login" className="text-teal text-sm font-medium hover:text-teal-deep transition-colors">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-xs text-ink-soft mb-2">
        Enter your new password below.
      </p>

      {error && (
        <div className="rounded-lg border border-rust/30 bg-rust/5 px-4 py-3 text-sm text-rust">
          {error}
        </div>
      )}

      <PasswordInput
        label="New password"
        placeholder="At least 8 characters"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={8}
        autoComplete="new-password"
      />

      <PasswordInput
        label="Confirm password"
        placeholder="Re-enter your password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        autoComplete="new-password"
      />

      <Button type="submit" loading={loading} className="w-full" size="lg">
        Reset password
      </Button>

      <div className="text-center">
        <Link href="/login" className="text-sm text-ink-soft hover:text-ink transition-colors">
          Back to sign in
        </Link>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Link href="/" className="text-xl font-bold text-ink mb-6 block">
            Midevela
          </Link>
          <h2 className="text-2xl font-display font-bold text-ink mb-1">Set new password</h2>
        </div>

        <Suspense fallback={<div className="text-sm text-ink-soft">Loading…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
