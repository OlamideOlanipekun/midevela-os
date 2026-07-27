"use client";

import type { ConversationEventItem } from "@/lib/conversations/types";

interface SessionTimelineProps {
  events: ConversationEventItem[];
}

export function SessionTimeline({ events }: SessionTimelineProps) {
  if (events.length === 0) return <p className="text-xs text-ink-soft">No events recorded.</p>;

  return (
    <div className="panel-section">
      <h3 className="panel-title">Session Timeline</h3>
      <div className="tm-line" style={{ gap: "0.75rem" }}>
        {events.map((e) => (
          <div key={e.id} className="tm-item">
            <div className="tm-dot" />
            <div className="tm-body">
              <span className="tm-action">{e.type.replace(/\./g, " · ")}</span>
              <span className="tm-time">{new Date(e.createdAt).toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
