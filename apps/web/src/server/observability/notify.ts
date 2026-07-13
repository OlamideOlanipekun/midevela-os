/**
 * Minimal alerting. The point is that a failure a human needs to act on
 * (a paid webhook that didn't activate a subscription, an unhandled 500)
 * is never silent.
 *
 * Two sinks, both best-effort and non-throwing:
 *   1. Always a structured `[ALERT]` console line — greppable in Vercel
 *      function logs even with no external service configured.
 *   2. If ALERT_WEBHOOK_URL is set, a JSON POST to it. The body is
 *      Slack-incoming-webhook compatible (`text`) but also carries the
 *      raw title/context so any other sink can consume it.
 *
 * This is the v1 stopgap; a real error-tracking service (Sentry) is the
 * post-launch upgrade. `alert()` must never throw into a request path.
 */

const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;

export type AlertContext = Record<string, unknown>;

export async function alert(title: string, context?: AlertContext): Promise<void> {
  // Baseline: structured log, always.
  console.error(`[ALERT] ${title}`, context ?? {});

  if (!ALERT_WEBHOOK_URL) return;

  try {
    await fetch(ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `[Midevela alert] ${title}`,
        title,
        context: context ?? {},
        ts: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    // A broken alert sink must not mask the original error.
    console.error("[ALERT] failed to deliver alert webhook:", err);
  }
}
