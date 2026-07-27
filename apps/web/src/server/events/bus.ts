import { EventEmitter } from "eventemitter3";
import { randomBytes } from "crypto";
import type { MidevelaEvent, EventHandler } from "@/server/events/types";

class EventBus {
  private emitter = new EventEmitter();
  private history: MidevelaEvent[] = [];
  private maxHistory = 100;

  publish(type: MidevelaEvent["type"], data: Record<string, unknown>): void;
  publish(event: { type: MidevelaEvent["type"] } & Record<string, unknown>): void;
  publish(typeOrEvent: any, data?: Record<string, unknown>): void {
    const event: MidevelaEvent = {
      eventId: randomBytes(8).toString("hex"),
      timestamp: Date.now(),
      ...(typeof typeOrEvent === "string" ? { type: typeOrEvent, ...data } : typeOrEvent),
    } as MidevelaEvent;

    // Wrap emitter calls so a crashing listener never bubbles to the caller
    try {
      this.emitter.emit(event.type, event);
    } catch (e) {
      console.error("EventBus: listener error on", event.type, e);
    }
    try {
      this.emitter.emit("*", event);
    } catch (e) {
      console.error("EventBus: wildcard listener error on", event.type, e);
    }

    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  on(event: string, handler: (event: any) => void): void {
    this.emitter.on(event, handler);
  }

  onAny(handler: (event: MidevelaEvent) => void): void {
    this.emitter.on("*", handler);
  }

  off(event: string, handler: (event: any) => void): void {
    this.emitter.off(event, handler);
  }

  getRecentHistory(count = 50): MidevelaEvent[] {
    return this.history.slice(-count);
  }
}

export const eventBus = new EventBus();
