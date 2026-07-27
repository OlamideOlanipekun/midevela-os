import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="text-center max-w-sm">
        <div className="text-6xl font-display font-bold text-ink mb-2">403</div>
        <div className="text-sm font-mono uppercase tracking-widest text-ink-soft mb-4">Forbidden</div>
        <p className="text-sm text-ink-soft mb-8 leading-relaxed">
          You don&apos;t have permission to access this area.
          If you believe this is an error, contact your administrator.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/" className="inline-flex items-center px-4 py-2 bg-teal text-white rounded-lg text-sm font-medium hover:bg-teal-deep transition-colors">
            Go to Mission Control
          </Link>
          <Link href="/login" className="inline-flex items-center px-4 py-2 border border-border text-ink rounded-lg text-sm font-medium hover:bg-black/5 transition-colors">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
