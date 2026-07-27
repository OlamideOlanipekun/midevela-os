import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="text-center max-w-sm">
        <div className="text-6xl font-display font-bold text-ink mb-2">404</div>
        <div className="text-sm font-mono uppercase tracking-widest text-ink-soft mb-4">Page not found</div>
        <p className="text-sm text-ink-soft mb-8 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Check the URL or navigate back to Mission Control.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/" className="inline-flex items-center px-4 py-2 bg-teal text-white rounded-lg text-sm font-medium hover:bg-teal-deep transition-colors">
            Go to Mission Control
          </Link>
        </div>
      </div>
    </div>
  );
}
