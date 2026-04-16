const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
]);

const IPV4_LOOPBACK_RE = /^127\./;
const IPV4_LINK_LOCAL_RE = /^169\.254\./;
const IPV4_PRIVATE_10_RE = /^10\./;
const IPV4_PRIVATE_172_RE = /^172\.(1[6-9]|2\d|3[01])\./;
const IPV4_PRIVATE_192_RE = /^192\.168\./;

function isBlockedIpv4(octets: number[]): boolean {
  const ip = `${octets[0]}.${octets[1]}.${octets[2]}.${octets[3]}`;
  if (IPV4_LOOPBACK_RE.test(ip)) return true;
  if (IPV4_LINK_LOCAL_RE.test(ip)) return true;
  if (IPV4_PRIVATE_10_RE.test(ip)) return true;
  if (IPV4_PRIVATE_172_RE.test(ip)) return true;
  if (IPV4_PRIVATE_192_RE.test(ip)) return true;
  if (octets[0] === 0) return true;
  if (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) return true;
  if (octets[0] === 192 && octets[1] === 0 && octets[2] === 0) return true;
  if (octets[0] === 192 && octets[1] === 0 && octets[2] === 2) return true;
  if (octets[0] === 198 && octets[1] === 51 && octets[2] === 100) return true;
  if (octets[0] === 203 && octets[1] === 0 && octets[2] === 113) return true;
  if (octets[0] >= 224) return true;
  return false;
}

function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = parseInt(part, 10);
    if (n > 255) return null;
    if (part.length > 1 && part.startsWith("0")) return null;
    octets.push(n);
  }
  return octets;
}

function isBlockedIpv6(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "::1" || h === "0:0:0:0:0:0:0:1" || h === "::" || h === "0:0:0:0:0:0:0:0") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true;
  if (h.startsWith("fe80")) return true;
  if (h.startsWith("::ffff:")) {
    const v4Part = h.slice(7);
    const octets = parseIpv4(v4Part);
    if (octets) return isBlockedIpv4(octets);
  }
  return false;
}

function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h === "0.0.0.0") return true;
  const v4 = parseIpv4(h);
  if (v4) return isBlockedIpv4(v4);
  if (h.includes(":")) return isBlockedIpv6(h);
  return false;
}

export function validateUrlForFetch(rawUrl: string): { safe: boolean; reason?: string } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { safe: false, reason: "Invalid URL format" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { safe: false, reason: "Only http(s) URLs are allowed" };
  }

  const hostname = url.hostname;
  if (!hostname) {
    return { safe: false, reason: "URL has no hostname" };
  }

  if (isPrivateHostname(hostname)) {
    return { safe: false, reason: "Requests to private/internal addresses are blocked" };
  }

  return { safe: true };
}
