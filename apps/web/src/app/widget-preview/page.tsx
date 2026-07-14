import Script from "next/script";

/**
 * Minimal, unauthenticated harness that loads the REAL widget for a given
 * public key — used by onboarding Step 6 ("preview your AI before
 * customers do") and reusable from Settings later. No dashboard chrome:
 * just a blank page the widget script attaches itself to, same as it
 * would on the merchant's own site.
 */
export default async function WidgetPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;

  if (!key) {
    return (
      <div style={{ fontFamily: "sans-serif", padding: 24, color: "#666" }}>
        Missing widget key.
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9" }}>
      <Script src="/widget/midevela-widget.js" data-widget-key={key} strategy="afterInteractive" />
    </div>
  );
}
