"use client";

import React, { useState, useRef, useEffect } from "react";
import "./playground.css";

interface ChatMessage {
  role: "customer" | "ai";
  content: string;
}

const SAMPLE_REPLIES = [
  "Hi there! Welcome to our store. How can I help you today?",
  "Great question! Let me show you some options that might interest you.",
  "We have several products in that range. Let me pull up the details.",
  "That's a popular choice! Here's what I'd recommend based on what you're looking for.",
  "Absolutely, I can help with that. Give me just a moment to find the best options for you.",
  "Is there anything specific you're looking for? I'm happy to help narrow it down.",
];

export default function PlaygroundPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", content: "Hi! I'm your AI sales assistant. Try sending a message to see how I respond." },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [aiName, setAiName] = useState("Lumi");
  const [accentColor, setAccentColor] = useState("#1EE67A");
  const [tone, setTone] = useState("friendly");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    fetch("/api/workspace/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          if (data.settings.aiName) setAiName(data.settings.aiName);
          if (data.settings.accentColor) setAccentColor(data.settings.accentColor);
          if (data.settings.tone) setTone(data.settings.tone);
        }
      })
      .catch(() => {});
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isTyping) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "customer", content: text }]);
    setIsTyping(true);
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
    const reply = SAMPLE_REPLIES[Math.floor(Math.random() * SAMPLE_REPLIES.length)];
    setMessages((prev) => [...prev, { role: "ai", content: reply }]);
    setIsTyping(false);
  };

  return (
    <div className="pg-page">
      <div className="pg-page-head">
        <div className="eyebrow"><span className="dot"></span> PLAYGROUND</div>
        <h1>Playground</h1>
        <p className="pg-subtitle">Test your AI agent&apos;s conversation flow in real time. Messages are simulated — no data is stored.</p>
      </div>

      <div className="pg-layout">
        <div className="pg-chat-col">
          <div className="pg-chat-window">
            <div className="pg-chat-header" style={{ background: accentColor }}>
              <div className="pg-ai-avatar">{aiName[0]}</div>
              <div>
                <div className="pg-ai-name">{aiName}</div>
                <div className="pg-ai-status">Online</div>
              </div>
            </div>
            <div className="pg-chat-body">
              {messages.map((msg, i) => (
                <div key={i} className={`pg-msg pg-msg-${msg.role}`}>
                  <div className="pg-bubble">{msg.content}</div>
                </div>
              ))}
              {isTyping && (
                <div className="pg-msg pg-msg-ai">
                  <div className="pg-bubble pg-typing">
                    <span className="pg-dot"></span><span className="pg-dot"></span><span className="pg-dot"></span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={handleSend} className="pg-input-row">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Talk to ${aiName}...`}
                disabled={isTyping}
              />
              <button type="submit" disabled={!input.trim() || isTyping}>Send</button>
            </form>
          </div>
        </div>

        <div className="pg-info-col">
          <div className="pg-card">
            <h3>About this playground</h3>
            <p>Responses are sample messages — they don&apos;t use your AI agent or show real product data. This gives you a feel for how the widget conversation flows.</p>
          </div>
          <div className="pg-card">
            <h3>Current config</h3>
            <div className="pg-config-row"><span>AI Name</span><span>{aiName}</span></div>
            <div className="pg-config-row"><span>Tone</span><span className="pg-cap">{tone}</span></div>
            <div className="pg-config-row"><span>Accent</span><span className="pg-swatch" style={{ background: accentColor }}></span></div>
          </div>
          <div className="pg-card">
            <h3>Coming soon</h3>
            <p>Live testing against your real AI agent, product catalog, and knowledge base — with full conversation transcriptions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
