"use client";

import { useEffect, useRef } from "react";
import type { MessageItem } from "@/lib/conversations/types";

interface ChatWindowProps {
  messages: MessageItem[];
  typing?: string | null;
}

export function ChatWindow({ messages, typing }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  return (
    <div className="chat-window">
      {messages.map((m) => (
        <div key={m.id} className={`chat-msg ${m.role === "CUSTOMER" ? "chat-customer" : m.role === "AI" ? "chat-ai" : "chat-human"}`}>
          <div className="chat-msg-hdr">
            <span className="chat-msg-role">{m.role === "CUSTOMER" ? "Customer" : m.role === "AI" ? "AI" : "Human"}</span>
            <span className="chat-msg-meta">
              {new Date(m.createdAt).toLocaleTimeString()}
              {m.role === "AI" && ` · ${m.confidence}% · ${m.latency}s`}
            </span>
          </div>
          <p className="chat-msg-content">{m.content}</p>
        </div>
      ))}
      {typing && (
        <div className="chat-msg chat-system">
          <div className="chat-msg-hdr">
            <span className="chat-msg-role">{typing}</span>
          </div>
          <div className="chat-typing">
            <span className="chat-typing-dot" /><span className="chat-typing-dot" /><span className="chat-typing-dot" />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
