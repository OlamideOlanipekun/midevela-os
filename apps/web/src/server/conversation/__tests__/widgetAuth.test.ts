import { describe, it, expect } from "vitest";
import { isOriginAllowed } from "../widgetAuth";

describe("isOriginAllowed", () => {
  it("allows exact domain match", () => {
    expect(isOriginAllowed(["shop.com"], "https://shop.com")).toBe(true);
  });

  it("allows subdomain", () => {
    expect(isOriginAllowed(["shop.com"], "https://store.shop.com")).toBe(true);
  });

  it("allows deep subdomain", () => {
    expect(isOriginAllowed(["shop.com"], "https://a.b.store.shop.com")).toBe(true);
  });

  it("rejects disallowed domain", () => {
    expect(isOriginAllowed(["shop.com"], "https://evil.com")).toBe(false);
  });

  it("rejects close-but-not-matching domain", () => {
    expect(isOriginAllowed(["shop.com"], "https://notshop.com")).toBe(false);
    expect(isOriginAllowed(["shop.com"], "https://xshop.com")).toBe(false);
    expect(isOriginAllowed(["shop.com"], "https://shop.com.evil.com")).toBe(false);
  });

  it("rejects empty allowlist (no longer permissive)", () => {
    expect(isOriginAllowed([], "https://shop.com")).toBe(false);
    expect(isOriginAllowed([], "http://localhost:3000")).toBe(false);
    expect(isOriginAllowed([], null)).toBe(false);
  });

  it("rejects null origin even with domains configured", () => {
    expect(isOriginAllowed(["shop.com"], null)).toBe(false);
  });

  it("rejects undefined origin", () => {
    expect(isOriginAllowed(["shop.com"], undefined as unknown as string)).toBe(false);
  });

  it("rejects invalid origin URL", () => {
    expect(isOriginAllowed(["shop.com"], "not-a-url")).toBe(false);
  });

  it("handles multiple allowed domains", () => {
    expect(isOriginAllowed(["shop.com", "store.io"], "https://store.io")).toBe(true);
    expect(isOriginAllowed(["shop.com", "store.io"], "https://evil.net")).toBe(false);
  });

  it("allows www subdomain when domain is listed", () => {
    expect(isOriginAllowed(["shop.com"], "https://www.shop.com")).toBe(true);
  });

  it("port does not affect hostname match", () => {
    expect(isOriginAllowed(["localhost"], "http://localhost:3000")).toBe(true);
    expect(isOriginAllowed(["shop.com"], "https://shop.com:8080")).toBe(true);
  });
});
