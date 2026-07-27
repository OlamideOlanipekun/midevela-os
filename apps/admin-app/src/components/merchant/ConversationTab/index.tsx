"use client";

import type { MerchantConversationData } from "@/lib/merchant/types";
import { MerchantStats } from "@/components/merchant/MerchantStats";
import { Badge } from "@/components/ui/Badge";

interface ConversationTabProps {
  data: MerchantConversationData | null;
}

const statusVariant = (s: string) => {
  switch (s) {
    case "ACTIVE": return "teal" as const;
    case "HANDED_OFF": return "gold" as const;
    case "ENDED": return "default" as const;
    default: return "default" as const;
  }
};

export function ConversationTab({ data }: ConversationTabProps) {
  if (!data) {
    return <p className="text-sm text-ink-soft">No conversation data available.</p>;
  }

  const stats = [
    { label: "Total Conversations", value: data.total.toLocaleString() },
    { label: "Resolved", value: data.resolved.toLocaleString() },
    { label: "Escalated", value: data.escalated.toLocaleString() },
    { label: "Avg Length", value: `${data.avgLength} msgs` },
    { label: "Avg Response", value: `${data.avgResponseTime}s` },
    { label: "Conversion Rate", value: `${data.conversionRate}%` },
  ];

  return (
    <div>
      <MerchantStats stats={stats} />

      <div className="stat-card mt-4">
        <h3 className="stat-title">Recent Conversations</h3>
        <div className="rc-list mt-2">
          {data.recent.map((c) => (
            <div key={c.id} className="rc-row">
              <div className="rc-info">
                <span className="rc-customer">{c.customerName || c.customerEmail || "Anonymous"}</span>
                <span className="rc-intent text-xs text-ink-soft">{c.intent}</span>
              </div>
              <div className="rc-meta">
                <Badge variant={statusVariant(c.status)} size="sm">{c.status}</Badge>
                <span className="text-xs text-ink-soft">{new Date(c.started).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
          {data.recent.length === 0 && (
            <p className="text-sm text-ink-soft">No conversations yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
