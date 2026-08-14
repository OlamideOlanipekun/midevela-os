import { describe, it, expect, vi } from "vitest";
import { assertPublicUrl, ipv4IsPrivate, ipv6IsPrivate, isPrivateAddress } from "../ssrfGuard";
import { detectBrandFromUrl } from "@/server/branding/detector";
import { safeFetch } from "@/server/website/crawler/fetcher";

describe("SSRF Guard — IP Validation", () => {
  it("blocks private IPv4 address ranges", () => {
    expect(ipv4IsPrivate("127.0.0.1")).toBe(true);
    expect(ipv4IsPrivate("127.255.255.255")).toBe(true);
    expect(ipv4IsPrivate("10.0.0.1")).toBe(true);
    expect(ipv4IsPrivate("10.255.255.255")).toBe(true);
    expect(ipv4IsPrivate("172.16.0.1")).toBe(true);
    expect(ipv4IsPrivate("172.31.255.255")).toBe(true);
    expect(ipv4IsPrivate("192.168.1.1")).toBe(true);
    expect(ipv4IsPrivate("0.0.0.0")).toBe(true);
  });

  it("blocks cloud metadata and link-local IPv4 addresses", () => {
    expect(ipv4IsPrivate("169.254.169.254")).toBe(true);
    expect(ipv4IsPrivate("169.254.169.253")).toBe(true);
    expect(ipv4IsPrivate("169.254.0.1")).toBe(true);
  });

  it("blocks CGNAT, multicast, broadcast, and reserved IPv4 ranges", () => {
    expect(ipv4IsPrivate("100.64.0.1")).toBe(true);
    expect(ipv4IsPrivate("100.127.255.255")).toBe(true);
    expect(ipv4IsPrivate("224.0.0.1")).toBe(true);
    expect(ipv4IsPrivate("240.0.0.1")).toBe(true);
    expect(ipv4IsPrivate("255.255.255.255")).toBe(true);
    expect(ipv4IsPrivate("192.0.2.1")).toBe(true);
    expect(ipv4IsPrivate("198.51.100.1")).toBe(true);
    expect(ipv4IsPrivate("203.0.113.1")).toBe(true);
  });

  it("allows public IPv4 addresses", () => {
    expect(ipv4IsPrivate("8.8.8.8")).toBe(false);
    expect(ipv4IsPrivate("1.1.1.1")).toBe(false);
    expect(ipv4IsPrivate("93.184.216.34")).toBe(false);
  });

  it("blocks private IPv6 address ranges", () => {
    expect(ipv6IsPrivate("::1")).toBe(true);
    expect(ipv6IsPrivate("::")).toBe(true);
    expect(ipv6IsPrivate("fe80::1")).toBe(true);
    expect(ipv6IsPrivate("fc00::1")).toBe(true);
    expect(ipv6IsPrivate("fd00::1234")).toBe(true);
    expect(ipv6IsPrivate("2001:db8::1")).toBe(true);
  });

  it("blocks IPv4-mapped and IPv4-compatible IPv6 addresses", () => {
    expect(ipv6IsPrivate("::ffff:127.0.0.1")).toBe(true);
    expect(ipv6IsPrivate("::ffff:169.254.169.254")).toBe(true);
    expect(ipv6IsPrivate("::ffff:10.0.0.1")).toBe(true);
    expect(ipv6IsPrivate("::ffff:7f00:1")).toBe(true);
    expect(ipv6IsPrivate("::127.0.0.1")).toBe(true);
  });

  it("allows public IPv6 addresses", () => {
    expect(ipv6IsPrivate("2001:4860:4860::8888")).toBe(false);
    expect(ipv6IsPrivate("2606:4700:4700::1111")).toBe(false);
  });
});

describe("SSRF Guard — assertPublicUrl", () => {
  it("rejects non-http and non-https schemes", async () => {
    await expect(assertPublicUrl("ftp://example.com")).rejects.toThrow();
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow();
    await expect(assertPublicUrl("gopher://127.0.0.1")).rejects.toThrow();
  });

  it("rejects localhost and literal private IP URLs", async () => {
    await expect(assertPublicUrl("http://localhost")).rejects.toThrow();
    await expect(assertPublicUrl("http://sub.localhost")).rejects.toThrow();
    await expect(assertPublicUrl("http://127.0.0.1")).rejects.toThrow();
    await expect(assertPublicUrl("http://169.254.169.254/latest/meta-data/")).rejects.toThrow();
    await expect(assertPublicUrl("http://10.0.0.1")).rejects.toThrow();
    await expect(assertPublicUrl("http://192.168.1.1")).rejects.toThrow();
    await expect(assertPublicUrl("http://[::1]")).rejects.toThrow();
  });

  it("accepts valid public domain URLs", async () => {
    const res = await assertPublicUrl("https://example.com");
    expect(res.protocol).toBe("https:");
    expect(res.hostname).toBe("example.com");
    expect(res.resolvedIp).toBeDefined();
    expect(isPrivateAddress(res.resolvedIp)).toBe(false);
  });
});

describe("SSRF Guard — safeFetch & Redirect Hardening", () => {
  it("safeFetch rejects direct internal IP targets", async () => {
    const res1 = await safeFetch("http://169.254.169.254/latest/meta-data/");
    expect("ok" in res1).toBe(false);

    const res2 = await safeFetch("http://127.0.0.1:8080");
    expect("ok" in res2).toBe(false);

    const res3 = await safeFetch("http://localhost:3000");
    expect("ok" in res3).toBe(false);
  });

  it("Brand Detector returns safe defaults on malicious or internal URLs without crashing", async () => {
    const result = await detectBrandFromUrl("http://169.254.169.254/latest/meta-data/");
    expect(result.primaryColor).toBeDefined();
    expect(result.themeMode).toBe("LIGHT");

    const resultLocal = await detectBrandFromUrl("http://127.0.0.1:9000");
    expect(resultLocal.primaryColor).toBeDefined();
  });
});
