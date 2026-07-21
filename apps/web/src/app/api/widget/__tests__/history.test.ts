import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock modules before importing the route handler
vi.mock("@/server/conversation/widgetAuth", () => ({
  resolveWidgetKey: vi.fn(),
  isOriginAllowed: vi.fn(),
  corsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/server/ratelimit/limiter", () => ({
  rateLimit: vi.fn(),
  clientIp: vi.fn(() => "1.2.3.4"),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    customer: { findUnique: vi.fn() },
    conversation: { findFirst: vi.fn() },
    message: { findMany: vi.fn() },
  },
}));

import { GET } from "../history/route";
import { resolveWidgetKey, isOriginAllowed } from "@/server/conversation/widgetAuth";
import { rateLimit } from "@/server/ratelimit/limiter";
import prisma from "@/lib/prisma";

const mockResolve = resolveWidgetKey as ReturnType<typeof vi.fn>;
const mockOriginAllowed = isOriginAllowed as ReturnType<typeof vi.fn>;
const mockRateLimit = rateLimit as ReturnType<typeof vi.fn>;
const mockFindCustomer = prisma.customer.findUnique as ReturnType<typeof vi.fn>;
const mockFindConversation = prisma.conversation.findFirst as ReturnType<typeof vi.fn>;
const mockFindMessages = prisma.message.findMany as ReturnType<typeof vi.fn>;

function makeRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost"));
}

beforeEach(() => {
  vi.clearAllMocks();

  // Default mocks: valid key, origin allowed, rate limit ok
  mockResolve.mockResolvedValue({
    id: "key-1",
    orgId: "org-1",
    allowedDomains: ["myshop.com"],
    org: { id: "org-1", name: "Test Shop", currency: "NGN" },
  });
  mockOriginAllowed.mockReturnValue(true);
  mockRateLimit.mockResolvedValue({ ok: true, remaining: 29, limit: 30, resetSec: 60 });
});

describe("GET /api/widget/history", () => {
  it("returns 400 when widget key is missing", async () => {
    const res = await GET(makeRequest("/api/widget/history?customerId=visitor-abc"));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe("key is required.");
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ ok: false, remaining: 0, limit: 30, resetSec: 60 });
    const res = await GET(
      makeRequest("/api/widget/history?key=mdv_pk_test&customerId=visitor-abc")
    );
    expect(res.status).toBe(429);
  });

  it("returns 401 for invalid widget key", async () => {
    mockResolve.mockResolvedValue(null);
    const res = await GET(
      makeRequest("/api/widget/history?key=mdv_pk_invalid&customerId=visitor-abc")
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Invalid widget key.");
  });

  it("returns 403 for disallowed origin", async () => {
    mockOriginAllowed.mockReturnValue(false);
    const req = makeRequest("/api/widget/history?key=mdv_pk_test&customerId=visitor-abc");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns empty result when customerId is missing", async () => {
    const res = await GET(makeRequest("/api/widget/history?key=mdv_pk_test"));
    const body = await res.json();
    expect(body.conversationId).toBeNull();
    expect(body.messages).toEqual([]);
  });

  it("returns empty result when customerId exceeds 128 chars", async () => {
    const longId = "a".repeat(200);
    const res = await GET(
      makeRequest(`/api/widget/history?key=mdv_pk_test&customerId=${longId}`)
    );
    const body = await res.json();
    expect(body.conversationId).toBeNull();
    expect(body.messages).toEqual([]);
  });

  it("returns empty result when customer is not found", async () => {
    mockFindCustomer.mockResolvedValue(null);
    const res = await GET(
      makeRequest("/api/widget/history?key=mdv_pk_test&customerId=visitor-unknown")
    );
    const body = await res.json();
    expect(body.conversationId).toBeNull();
    expect(body.messages).toEqual([]);
  });

  it("returns empty result when no active conversation exists", async () => {
    mockFindCustomer.mockResolvedValue({ id: "cust-1", orgId: "org-1", externalId: "visitor-abc" });
    mockFindConversation.mockResolvedValue(null);
    const res = await GET(
      makeRequest("/api/widget/history?key=mdv_pk_test&customerId=visitor-abc")
    );
    const body = await res.json();
    expect(body.conversationId).toBeNull();
    expect(body.messages).toEqual([]);
  });

  it("returns messages for an active conversation", async () => {
    mockFindCustomer.mockResolvedValue({ id: "cust-1", orgId: "org-1", externalId: "visitor-abc" });
    mockFindConversation.mockResolvedValue({
      id: "conv-1",
      orgId: "org-1",
      customerId: "cust-1",
      status: "ACTIVE",
      context: { categoryName: "Skincare" },
    });
    mockFindMessages.mockResolvedValue([
      {
        role: "AI",
        content: "Hello! How can I help?",
        createdAt: new Date("2026-07-20T12:00:00Z"),
        recommendations: [],
      },
      {
        role: "CUSTOMER",
        content: "I need moisturizer",
        createdAt: new Date("2026-07-20T12:01:00Z"),
        recommendations: [],
      },
      {
        role: "AI",
        content: "Great choice! Here are some options:",
        createdAt: new Date("2026-07-20T12:02:00Z"),
        recommendations: [
          { id: "p1", name: "Light Moisturizer", price: "₦12,000", whyThis: "Great for oily skin", url: null, imageUrl: null },
        ],
      },
    ]);

    const res = await GET(
      makeRequest("/api/widget/history?key=mdv_pk_test&customerId=visitor-abc")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.conversationId).toBe("conv-1");
    expect(body.messages).toHaveLength(3);

    // First message: AI → assistant
    expect(body.messages[0].role).toBe("assistant");
    expect(body.messages[0].content).toBe("Hello! How can I help?");

    // Second message: CUSTOMER → user
    expect(body.messages[1].role).toBe("user");
    expect(body.messages[1].content).toBe("I need moisturizer");

    // Third message: AI with recommendations
    expect(body.messages[2].role).toBe("assistant");
    expect(body.messages[2].recommendations).toHaveLength(1);
    expect(body.messages[2].recommendations[0].name).toBe("Light Moisturizer");

    // Context included
    expect(body.context).toEqual({ categoryName: "Skincare" });
  });

  it("respects the message limit (max 50)", async () => {
    mockFindCustomer.mockResolvedValue({ id: "cust-1", orgId: "org-1", externalId: "visitor-abc" });
    mockFindConversation.mockResolvedValue({
      id: "conv-1",
      orgId: "org-1",
      customerId: "cust-1",
      status: "ACTIVE",
      context: {},
    });

    const manyMessages = Array.from({ length: 100 }, (_, i) => ({
      role: i % 2 === 0 ? "AI" : "CUSTOMER",
      content: `Message ${i + 1}`,
      createdAt: new Date(`2026-07-20T12:${String(i).padStart(2, "0")}:00Z`),
      recommendations: [],
    }));
    mockFindMessages.mockResolvedValue(manyMessages.slice(0, 50));

    const res = await GET(
      makeRequest("/api/widget/history?key=mdv_pk_test&customerId=visitor-abc")
    );
    const body = await res.json();

    // Should return at most 50 messages
    expect(body.messages.length).toBeLessThanOrEqual(50);
    // take: 50 was passed to prisma, so we expect 50
    expect(body.messages.length).toBe(50);
    // Verify take was called with 50
    expect(mockFindMessages).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    );
  });

  it("filters customer within the widget key's org (no cross-tenant)", async () => {
    // The findUnique uses `orgId: key.orgId` — if the customer exists
    // under a different orgId, they won't be found.
    mockFindCustomer.mockResolvedValue(null);

    const res = await GET(
      makeRequest("/api/widget/history?key=mdv_pk_test&customerId=visitor-other-org")
    );
    const body = await res.json();
    expect(body.conversationId).toBeNull();
    expect(body.messages).toEqual([]);

    // Verify the query was scoped to the widget key's org
    expect(mockFindCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId_externalId: expect.objectContaining({
            orgId: "org-1",
          }),
        }),
      })
    );
  });
});
