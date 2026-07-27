"use client";

import { useState, useEffect, useRef } from "react";
import type { ConversationEventItem } from "@/lib/conversations/types";

interface ReplayControlsProps {
  events: ConversationEventItem[];
}

export function ReplayControls({ events }: ReplayControlsProps) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!playing || index >= events.length) {
      setPlaying(false);
      return;
    }
    const event = events[index];
    const nextEvent = events[index + 1];
    const delay = nextEvent
      ? Math.min((new Date(nextEvent.createdAt).getTime() - new Date(event.createdAt).getTime()) / speed, 5000)
      : 1000;
    timerRef.current = setTimeout(() => setIndex((i) => i + 1), delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [playing, index, speed, events]);

  const reset = () => { setPlaying(false); setIndex(0); };

  const current = events[index];

  return (
    <div className="replay-bar">
      <div className="replay-controls">
        <button className="replay-btn" onClick={() => setPlaying((p) => !p)} disabled={events.length === 0}>
          {playing ? "⏸" : "▶"}
        </button>
        <button className="replay-btn" onClick={reset}>⏹</button>
        <div className="replay-speed">
          {[1, 2, 4].map((s) => (
            <button key={s} className={`replay-speed-btn ${speed === s ? "active" : ""}`} onClick={() => setSpeed(s)}>{s}x</button>
          ))}
        </div>
        <span className="replay-progress">{index + 1} / {events.length}</span>
      </div>
      {current && (
        <div className="replay-event">
          <span className="replay-event-type">{current.type}</span>
          <span className="replay-event-time">{new Date(current.createdAt).toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  );
}
