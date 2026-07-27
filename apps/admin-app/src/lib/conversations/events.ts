export const CONVERSATION_EVENT_TYPES = [
  "conversation.started",
  "conversation.closed",
  "message.sent",
  "message.received",
  "typing.started",
  "typing.stopped",
  "ai.generated",
  "human.joined",
  "human.left",
  "conversation.tagged",
  "conversation.escalated",
  "ai.resumed",
] as const;

export type ConversationEventType = typeof CONVERSATION_EVENT_TYPES[number];

interface SSEClient {
  id: string;
  controller: ReadableStreamDefaultController;
}

const clients = new Map<string, SSEClient>();

export function addSSEClient(id: string, controller: ReadableStreamDefaultController): void {
  clients.set(id, { id, controller });
}

export function removeSSEClient(id: string): void {
  clients.delete(id);
}

export function broadcastConversationEvent(event: {
  type: string;
  conversationId: string;
  data?: Record<string, unknown>;
}): void {
  const payload = `data: ${JSON.stringify({ t: Date.now(), ...event })}\n\n`;
  for (const client of clients.values()) {
    try {
      client.controller.enqueue(new TextEncoder().encode(payload));
    } catch {
      clients.delete(client.id);
    }
  }
}
