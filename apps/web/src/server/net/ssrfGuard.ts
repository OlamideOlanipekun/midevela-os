import { lookup as lookupPromise } from "dns/promises";
import { lookup as dnsLookup } from "dns";
import { isIP } from "net";
import { ApiError } from "@/server/http";

/**
 * SSRF guard for all outbound HTTP requests. Resolves target hostnames and
 * rejects any URL that maps to private / loopback / link-local / metadata / reserved
 * address space.
 *
 * Provides DNS rebinding protection by performing connection-time IP validation
 * via custom lookup handler `ssrfLookup`.
 */

export function ipv4IsPrivate(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true; // malformed → reject
  const [a, b, c, d] = p;
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 0) return true; // 0.0.0.0/8 unspecified / current network
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // 192.0.0.0/24 & 192.0.2.0/24 reserved
  if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 TEST-NET-3
  if (a === 198 && b >= 18 && b <= 19) return true; // 198.18.0.0/15 benchmarking
  if (a >= 224) return true; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved / broadcast
  return false;
}

export function ipv6IsPrivate(ip: string): boolean {
  const addr = ip.toLowerCase().split("%")[0].trim(); // strip zone id
  if (addr === "::1" || addr === "::" || addr === "0:0:0:0:0:0:0:1" || addr === "0:0:0:0:0:0:0:0") return true; // loopback / unspecified

  // Link-local: fe80::/10 (fe80 - febf)
  if (/^fe[89ab]/i.test(addr)) return true;

  // Unique-local: fc00::/7 (fc00 - fdff)
  if (/^f[cd]/i.test(addr)) return true;

  // Documentation: 2001:db8::/32
  if (addr.startsWith("2001:db8:") || addr === "2001:db8") return true;

  // IPv4-mapped (::ffff:127.0.0.1 or ::ffff:7f00:1)
  const mappedDot = addr.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mappedDot) return ipv4IsPrivate(mappedDot[1]);

  const mappedHex = addr.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (mappedHex) {
    const p1 = parseInt(mappedHex[1], 16);
    const p2 = parseInt(mappedHex[2], 16);
    const v4 = `${(p1 >> 8) & 0xff}.${p1 & 0xff}.${(p2 >> 8) & 0xff}.${p2 & 0xff}`;
    return ipv4IsPrivate(v4);
  }

  // IPv4-compatible (::127.0.0.1)
  const compatDot = addr.match(/^::(\d+\.\d+\.\d+\.\d+)$/i);
  if (compatDot) return ipv4IsPrivate(compatDot[1]);

  return false;
}

export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return ipv4IsPrivate(ip);
  if (kind === 6) return ipv6IsPrivate(ip);
  return true; // not a recognizable IP → reject
}

/**
 * Custom DNS lookup handler for fetch/http connections that enforces SSRF checks
 * at connection time, preventing DNS rebinding attacks (TOCTOU).
 */
export function ssrfLookup(
  hostname: string,
  options: any,
  callback?: (err: Error | null, address?: string | any, family?: number) => void
) {
  const cb = typeof options === "function" ? options : callback!;
  const opts = typeof options === "object" ? options : {};

  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return cb(new ApiError(400, "URL points to a non-public address."));
  }

  dnsLookup(hostname, opts, (err, address, family) => {
    if (err) return cb(err);

    if (Array.isArray(address)) {
      if (address.some((item) => isPrivateAddress(typeof item === "string" ? item : item.address))) {
        return cb(new ApiError(400, "SSRF Blocked: Host resolves to private address space."));
      }
      return cb(null, address, family);
    }

    const ipStr = typeof address === "string" ? address : (address as any)?.address;
    if (!ipStr || isPrivateAddress(ipStr)) {
      return cb(new ApiError(400, "SSRF Blocked: Host resolves to private address space."));
    }

    return cb(null, address, family);
  });
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
    records = await lookupPromise(host, { all: true });
  } catch {
    throw new ApiError(400, "Could not resolve URL host.");
  }
  if (records.length === 0 || records.some((r) => isPrivateAddress(r.address))) {
    throw new ApiError(400, "URL points to a non-public address.");
  }

  return Object.assign(u, { resolvedIp: records[0].address });
}

