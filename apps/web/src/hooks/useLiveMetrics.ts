import { useEffect, useRef, useState, useCallback } from "react";

interface LiveMetrics {
  liveConversations: number;
  visitorsOnline: number;
  revenueToday: number;
  revenueThisMonth: number;
  messagesToday: number;
  aiConfidence: number;
  aiLatency: number;
  aiTokens: number;
  aiResponses: number;
  totalMerchants: number;
  activeMerchants: number;
  widgetsInstalled: number;
  recommendations: number;
  handoffs: number;
}

interface ActivityEvent {
  action: string;
  merchantName?: string;
  merchantId?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

interface QueueHealth {
  queue: string;
  pending: number;
  active: number;
  failed: number;
}

type SSEHandler = {
  onMetrics?: (metrics: Partial<LiveMetrics>) => void;
  onActivity?: (activity: ActivityEvent) => void;
  onQueue?: (queue: QueueHealth) => void;
  onEvent?: (event: any) => void;
};

type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

export function useLiveMetrics(handlers?: SSEHandler) {
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource("/admin/api/live?channels=dashboard");
    eventSourceRef.current = es;
    setConnectionState("connecting");

    es.onopen = () => {
      setConnectionState("connected");
    };

    es.addEventListener("message", (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "snapshot") {
          setMetrics(parsed.data);
          return;
        }
        if (parsed.type === "metrics") {
          setMetrics((prev) => (prev ? { ...prev, ...parsed.data } : prev));
          handlersRef.current?.onMetrics?.(parsed.data);
          return;
        }
        if (parsed.type === "activity") {
          const activity = parsed.data as ActivityEvent;
          setActivities((prev) => [activity, ...prev].slice(0, 100));
          handlersRef.current?.onActivity?.(activity);
          return;
        }
        if (parsed.type === "queue") {
          handlersRef.current?.onQueue?.(parsed.data as QueueHealth);
          return;
        }
        if (parsed.type === "event") {
          handlersRef.current?.onEvent?.(parsed.data);
          return;
        }
      } catch {
        // Ignore parse errors
      }
    });

    es.onerror = () => {
      setConnectionState("error");
      es.close();
      reconnectTimeoutRef.current = setTimeout(connect, 5000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  return {
    metrics,
    activities,
    connectionState,
    reconnect: connect,
  };
}
