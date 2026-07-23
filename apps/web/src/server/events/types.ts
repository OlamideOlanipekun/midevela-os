export interface BaseEvent {
  eventId: string;
  timestamp: number;
  source: string;
}

export interface MerchantCreatedEvent extends BaseEvent {
  type: "merchant.created";
  merchantId: string;
  merchantName: string;
  slug: string;
}

export interface MerchantDeletedEvent extends BaseEvent {
  type: "merchant.deleted";
  merchantId: string;
}

export interface MerchantSuspendedEvent extends BaseEvent {
  type: "merchant.suspended";
  merchantId: string;
  reason?: string;
}

export interface ConversationStartedEvent extends BaseEvent {
  type: "conversation.started";
  conversationId: string;
  merchantId: string;
  merchantName: string;
  customerId: string;
  channel: string;
}

export interface ConversationEndedEvent extends BaseEvent {
  type: "conversation.ended";
  conversationId: string;
  merchantId: string;
  outcome: string;
  duration: number;
}

export interface MessageSentEvent extends BaseEvent {
  type: "message.sent";
  conversationId: string;
  merchantId: string;
  role: "customer" | "ai" | "system";
  inputTokens: number;
  outputTokens: number;
}

export interface RecommendationMadeEvent extends BaseEvent {
  type: "recommendation.made";
  conversationId: string;
  merchantId: string;
  productId: string;
  productName: string;
}

export interface PurchaseCompletedEvent extends BaseEvent {
  type: "purchase.completed";
  merchantId: string;
  customerId: string;
  amount: number;
  currency: string;
  productIds: string[];
}

export interface AIResponseGeneratedEvent extends BaseEvent {
  type: "ai.response.generated";
  merchantId: string;
  conversationId: string;
  latency: number;
  confidence: number;
  tokens: number;
  intent: string;
}

export interface HumanHandoffRequestedEvent extends BaseEvent {
  type: "human.handoff.requested";
  conversationId: string;
  merchantId: string;
  customerName: string;
  reason: string;
}

export interface KnowledgeIndexedEvent extends BaseEvent {
  type: "knowledge.indexed";
  merchantId: string;
  entryId: string;
  entryType: string;
  chunkCount: number;
}

export interface KnowledgeFailedEvent extends BaseEvent {
  type: "knowledge.failed";
  merchantId: string;
  entryId?: string;
  error: string;
}

export interface ImportStartedEvent extends BaseEvent {
  type: "import.started";
  merchantId: string;
  source: string;
  itemCount: number;
}

export interface ImportCompletedEvent extends BaseEvent {
  type: "import.completed";
  merchantId: string;
  imported: number;
  skipped: number;
  failed: number;
}

export interface PaymentSucceededEvent extends BaseEvent {
  type: "payment.succeeded";
  merchantId: string;
  amount: number;
  currency: string;
  planCode: string;
}

export interface PaymentFailedEvent extends BaseEvent {
  type: "payment.failed";
  merchantId: string;
  amount: number;
  reason: string;
}

export interface AdminLoginEvent extends BaseEvent {
  type: "admin.login";
  adminId: string;
}

export interface WidgetInstalledEvent extends BaseEvent {
  type: "widget.installed";
  merchantId: string;
}

export interface FeatureToggledEvent extends BaseEvent {
  type: "feature.toggled";
  featureKey: string;
  enabled: boolean;
}

export interface QueueHealthEvent extends BaseEvent {
  type: "queue.health";
  queue: string;
  pending: number;
  active: number;
  failed: number;
}

export interface InfrastructureMetricEvent extends BaseEvent {
  type: "infrastructure.metric";
  cpu: number;
  ram: number;
  disk: number;
  label: string;
}

export interface VisitorConnectedEvent extends BaseEvent {
  type: "visitor.connected";
  merchantId: string;
  ip: string;
  country: string;
}

export interface VisitorDisconnectedEvent extends BaseEvent {
  type: "visitor.disconnected";
  merchantId: string;
}

export type MidevelaEvent =
  | MerchantCreatedEvent
  | MerchantDeletedEvent
  | MerchantSuspendedEvent
  | ConversationStartedEvent
  | ConversationEndedEvent
  | MessageSentEvent
  | RecommendationMadeEvent
  | PurchaseCompletedEvent
  | AIResponseGeneratedEvent
  | HumanHandoffRequestedEvent
  | KnowledgeIndexedEvent
  | KnowledgeFailedEvent
  | ImportStartedEvent
  | ImportCompletedEvent
  | PaymentSucceededEvent
  | PaymentFailedEvent
  | AdminLoginEvent
  | WidgetInstalledEvent
  | FeatureToggledEvent
  | QueueHealthEvent
  | InfrastructureMetricEvent
  | VisitorConnectedEvent
  | VisitorDisconnectedEvent;

export type EventHandler<T extends MidevelaEvent = MidevelaEvent> = (event: T) => void | Promise<void>;
