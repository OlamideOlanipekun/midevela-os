/**
 * The v1.0 spec's `/widget/chat` — same handler as /api/widget/message
 * (context-grounded conversation turn). Kept as a thin alias rather than a
 * duplicate implementation so there's exactly one chat code path to
 * maintain; the widget calls this name, /api/widget/message stays as the
 * underlying implementation.
 */
export { POST, OPTIONS } from "../message/route";
