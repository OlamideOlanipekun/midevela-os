import { lookup } from "dns/promises";
import { isIP } from "net";
import { ApiError } from "@/server/http";

/**
 * SSRF guard for the crawler. It fetches arbitrary merchant-supplied URLs
 * server-side, so without this a signed-up user could point it at cloud
 * metadata (169.254.169.254), localhost, or internal RFC-1918 hosts and
 * use our server as a proxy into private infrastructure.
 *
 * The guard resolves the hostname and rejects any URL that maps to
 * private / loopback / link-local / reserved address space. It must be
 * called before EVERY fetch — the initial URL and every internal link the
 * crawler follows.
 *
 * Residual risk (accepted for v1): DNS rebinding between this check and
 * the actual fetch (TOCTOU). The post-launch hardening is to resolve once
 * here and fetch against the pinned IP.
 */

function ipv4IsPrivate(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true; // malformed → reject
  const [a, b] = p;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a >= 224) return true; // 224.0.0.0/4 multicast + 240/4 reserved
  return false;
}

function ipv6IsPrivate(ip: string): boolean {
  const addr = ip.toLowerCase().split("%")[0]; // strip zone id
  if (addr === "::1" || addr === "::") return true; // loopback / unspecified
  if (addr.startsWith("fe80")) return true; // link-local
  if (addr.startsWith("fc") || addr.startsWith("fd")) return true; // fc00::/7 unique-local
  // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded v4.
  const mapped = addr.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4IsPrivate(mapped[1]);
  return false;
}

function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return ipv4IsPrivate(ip);
  if (kind === 6) return ipv6IsPrivate(ip);
  return true; // not a recognizable IP → reject
}

/**
 * Validates a URL is safe to fetch: http(s) scheme and a hostname that
 * resolves to a public address. Throws ApiError(400) otherwise. Returns
 * the parsed URL on success.
 */
export async function assertPublicUrl(raw: string): Promise<URL & { resolvedIp: string }> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new ApiError(400, "Invalid URL.");
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new ApiError(400, "Only http and https URLs are allowed.");
  }

  const host = u.hostname;

  // A literal IP in the URL: check it directly (no DNS).
  if (isIP(host)) {
    if (isPrivateAddress(host)) {
      throw new ApiError(400, "URL points to a non-public address.");
    }
    return Object.assign(u, { resolvedIp: host });
  }

  // Reject obvious localhost aliases before we even resolve.
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new ApiError(400, "URL points to a non-public address.");
  }

  // Resolve the hostname and reject if ANY returned address is private —
  // a host with even one internal A/AAAA record is not safe to fetch.
  let records: { address: string }[];
  try {
    records = await lookup(host, { all: true });
  } catch {
    throw new ApiError(400, "Could not resolve URL host.");
  }
  if (records.length === 0 || records.some((r) => isPrivateAddress(r.address))) {
    throw new ApiError(400, "URL points to a non-public address.");
  }

  return Object.assign(u, { resolvedIp: records[0].address });
}
