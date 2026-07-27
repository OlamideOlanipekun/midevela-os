"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Admin app error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-2xl font-display font-bold text-ink mb-2">Something went wrong</h1>
        <p className="text-sm text-ink-soft mb-8 leading-relaxed">
          An unexpected error occurred. Our team has been notified.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset}>Try again</Button>
          <Button variant="secondary" onClick={() => router.push("/")}>
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}
