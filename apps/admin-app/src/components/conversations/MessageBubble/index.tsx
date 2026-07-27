"use client";

import type { MessageItem } from "@/lib/conversations/types";

export function MessageBubble({ message }: { message: MessageItem }) {
  return (
    <div className={`chat-msg ${message.role === "CUSTOMER" ? "chat-customer" : message.role === "AI" ? "chat-ai" : "chat-human"}`}>
      <div className="chat-msg-hdr">
        <span className="chat-msg-role">{message.role}</span>
        <span className="chat-msg-meta">
          {new Date(message.createdAt).toLocaleTimeString()}
          {message.role === "AI" && ` · ${message.confidence}% · ${message.latency}s`}
        </span>
      </div>
      <p className="chat-msg-content">{message.content}</p>
      {message.role === "AI" && (
        <div className="chat-msg-footer">
          <span className="chat-msg-tag">{message.modelUsed}</span>
          <span className="chat-msg-tag">{message.inputTokens + message.outputTokens} tokens</span>
        </div>
      )}
    </div>
  );
}
