/**
 * Is a URL aimed at the visitor's own machine or local network?
 *
 * Chrome asks the visitor for "local network access" the moment a public page
 * loads anything from localhost or a private address (Local Network Access,
 * Chrome 142+). On slodi.is that only ever means a mistake — an author pasting
 * an image link copied from their own dev server or router — and the prompt it
 * produces looks like the site is snooping. The Permissions-Policy header in
 * next.config.ts already makes such requests fail without a prompt; this is
 * the second layer, so the request is never made at all.
 *
 * The backend refuses the same URLs on save (app/domain/private_network.py).
 * This catches what was saved before that check existed.
 */

/** A hostname the browser would resolve to this machine or the local network. */
export function isPrivateNetworkHost(hostname: string): boolean {
  let host = hostname.toLowerCase().replace(/\.$/, "");
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  if (!host) return false;

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;

  const v4 = parseIPv4(host);
  if (v4) return isPrivateIPv4(v4);

  if (host.includes(":")) {
    const v6 = parseIPv6(host);
    return v6 ? isPrivateIPv6(v6) : false;
  }
  return false;
}

/**
 * Does this URL point at a private or loopback host? Relative URLs, `data:`
 * and `blob:` URLs never do. Unparseable input is reported as not private;
 * use {@link publicMediaUrl} to also drop that.
 */
export function isPrivateNetworkUrl(url: string): boolean {
  try {
    return isPrivateNetworkHost(new URL(url, "https://slodi.is").hostname);
  } catch {
    return false;
  }
}

const MEDIA_PROTOCOLS = new Set(["http:", "https:", "data:", "blob:"]);

/**
 * `url` if it is safe to hand to an `<img src>` (or any media element), else
 * `undefined`. Drops private-network hosts, unparseable URLs and schemes no
 * image should use.
 */
export function publicMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(url, "https://slodi.is");
  } catch {
    return undefined;
  }
  if (!MEDIA_PROTOCOLS.has(parsed.protocol)) return undefined;
  if (isPrivateNetworkHost(parsed.hostname)) return undefined;
  return url;
}

// ── IPv4 ──────────────────────────────────────────────────────────────────────

/**
 * A dotted-quad IPv4 address as four octets. `new URL()` has already turned
 * every other spelling a browser accepts (`0x7f.1`, `2130706433`, `127.1`)
 * into this form, so a hostname that came out of `URL` needs nothing more.
 */
function parseIPv4(host: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const octets = m.slice(1).map(Number);
  return octets.every((o) => o <= 255) ? octets : null;
}

function isPrivateIPv4([a, b]: number[]): boolean {
  return (
    a === 0 || // 0.0.0.0/8 — Chrome treats 0.0.0.0 as this machine
    a === 10 || // 10.0.0.0/8
    a === 127 || // 127.0.0.0/8 loopback
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 carrier-grade NAT
    (a === 169 && b === 254) || // 169.254.0.0/16 link-local
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) // 192.168.0.0/16
  );
}

// ── IPv6 ──────────────────────────────────────────────────────────────────────

/** An IPv6 address as eight 16-bit groups, or null if it is not one. */
function parseIPv6(host: string): number[] | null {
  let text = host;
  // A trailing dotted quad (::ffff:127.0.0.1) is two groups.
  const tail = /^(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(text);
  if (tail) {
    const v4 = parseIPv4(tail[2]);
    if (!v4) return null;
    text =
      tail[1] + ((v4[0] << 8) | v4[1]).toString(16) + ":" + ((v4[2] << 8) | v4[3]).toString(16);
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const parse = (s: string) => (s ? s.split(":") : []);
  const head = parse(halves[0]);
  const rest = halves.length === 2 ? parse(halves[1]) : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...rest];
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

function isPrivateIPv6(g: number[]): boolean {
  const zeroUntil = (n: number) => g.slice(0, n).every((x) => x === 0);
  if (zeroUntil(7) && (g[7] === 0 || g[7] === 1)) return true; // :: and ::1
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  // ::ffff:a.b.c.d — an IPv4 address in IPv6 clothing.
  if (zeroUntil(5) && g[5] === 0xffff) {
    return isPrivateIPv4([g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff]);
  }
  return false;
}
