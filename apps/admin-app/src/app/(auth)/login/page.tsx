"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input, PasswordInput } from "@/components/ui/Input";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (!result.ok) {
      setError(result.error ?? "Login failed");
      return;
    }

    router.push("/");
  };

  return (
    <>
      {/* Left: Brand panel */}
      <div className="hidden lg:flex w-1/2 bg-pine-black text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="relative z-10">
          <Link href="/" className="text-xl font-bold tracking-tight">
            <span className="text-sage">Midevela</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-md">
          <div className="eyebrow-dark text-sage/80 font-mono text-xs uppercase tracking-widest mb-4">
            Mission Control
          </div>
          <h1 className="text-4xl font-display font-bold leading-tight mb-4">
            The admin layer for your AI sales floor.
          </h1>
          <p className="text-white/60 text-sm leading-relaxed">
            Monitor every merchant, manage conversations, configure AI agents, and keep the platform running — all from one place.
          </p>
        </div>

        <div className="relative z-10 flex gap-8 text-xs text-white/40 font-mono">
          <span>24/7 Platform</span>
          <span>RBAC</span>
          <span>Audit Trail</span>
        </div>

        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-teal blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-sage blur-3xl" />
        </div>
      </div>

      {/* Right: Form panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <Link href="/" className="lg:hidden text-xl font-bold text-ink mb-6 block">
              Midevela
            </Link>
            <h2 className="text-2xl font-display font-bold text-ink mb-1">Welcome back</h2>
            <p className="text-sm text-ink-soft">Sign in to access Mission Control.</p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-rust/30 bg-rust/5 px-4 py-3 text-sm text-rust">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email"
              type="email"
              placeholder="admin@midevela.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <PasswordInput
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-ink-soft cursor-pointer">
                <input type="checkbox" className="rounded border-border text-teal focus:ring-teal/30" />
                Remember me
              </label>
              <Link href="/forgot-password" className="text-teal hover:text-teal-deep transition-colors font-medium">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
