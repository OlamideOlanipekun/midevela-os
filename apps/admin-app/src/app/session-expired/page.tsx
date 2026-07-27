"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function SessionExpiredPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">⏰</div>
        <h1 className="text-2xl font-display font-bold text-ink mb-2">Session expired</h1>
        <p className="text-sm text-ink-soft mb-8 leading-relaxed">
          Your session has expired due to inactivity. Please sign in again to continue.
        </p>
        <Button onClick={() => router.push("/login")} size="lg">
          Sign in again
        </Button>
      </div>
    </div>
  );
}
