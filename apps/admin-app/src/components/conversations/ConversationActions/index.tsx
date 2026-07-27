"use client";

import { Button } from "@/components/ui/Button";

interface ConversationActionsProps {
  conversationId: string;
  humanJoined: boolean;
  aiPaused: boolean;
  onJoin: () => void;
  onResumeAI: () => void;
}

export function ConversationActions({ conversationId, humanJoined, aiPaused, onJoin, onResumeAI }: ConversationActionsProps) {
  return (
    <div className="conv-actions">
      {!humanJoined ? (
        <Button variant="outline" size="sm" onClick={onJoin}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
          Join
        </Button>
      ) : aiPaused ? (
        <Button variant="outline" size="sm" onClick={onResumeAI}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          Resume AI
        </Button>
      ) : (
        <span className="text-xs text-ink-soft">Human is observing</span>
      )}
    </div>
  );
}
