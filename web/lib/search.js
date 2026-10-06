"use strict";
// Stage 04 research layer: web search + retrieval of underlying pages/documents.
// All retrieved content is UNTRUSTED input: it is truncated, never executed, and only
// its text is used as evidence. Fetch destinations are validated; private/internal
// network targets are blocked; redirects are followed only to validated hosts.
const https = require("https");
const http = require("http");
const dns = require("dns");
const { URL } = require("url");
const net = require("net");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const MAX_BODY = 400_000; // bytes — enough for a full article, bounded for untrusted input
const TIMEOUT_MS = 20_000;

function ipv4Int(ip) {
  return ip.split(".").reduce((n, part) => (n * 256) + Number(part), 0);
}

function ipv4IsNonPublic(ip) {
  const value = ipv4Int(ip) >>> 0;
  const ranges = [
    ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
    ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24],
    ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
    ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
  ];
  return ranges.some(([network, bits]) => {
    const shift = 32 - bits;
    return (value >>> shift) === ((ipv4Int(network) >>> shift));
  });
}

function ipv6Groups(ip) {
  let value = ip.toLowerCase().split("%")[0];
  if (value.includes(".")) {
    const split = value.lastIndexOf(":");
    const ipv4 = value.slice(split + 1);
    if (net.isIP(ipv4) !== 4) return null;
    const octets = ipv4.split(".").map(Number);
    value = value.slice(0, split) + ":" + ((octets[0] << 8) | octets[1]).toString(16) + ":" + ((octets[2] << 8) | octets[3]).toString(16);
  }
  const parts = value.split("::");
  if (parts.length > 2) return null;
  const left = parts[0] ? parts[0].split(":") : [];
  const right = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const fill = 8 - left.length - right.length;
  if ((parts.length === 1 && fill !== 0) || (parts.length === 2 && fill < 1)) return null;
  const groups = [...left, ...Array(fill).fill("0"), ...right].map((x) => /^[0-9a-f]{1,4}$/.test(x) ? parseInt(x, 16) : NaN);
  return groups.length === 8 && groups.every(Number.isFinite) ? groups : null;
}

function ipIsPrivate(ip) {
  if (!ip) return true;
  const bare = String(ip).replace(/^\[|\]$/g, "").split("%")[0];
  const family = net.isIP(bare);
  if (family === 4) return ipv4IsNonPublic(bare);
  if (family !== 6) return true;
  const groups = ipv6Groups(bare);
  if (!groups) return true;
  // IPv4-mapped IPv6 must inherit the embedded IPv4 address's policy.
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    const a = groups[6] >> 8, b = groups[6] & 255, c = groups[7] >> 8, d = groups[7] & 255;
    return ipv4IsNonPublic([a, b, c, d].join("."));
  }
  // Only global-unicast 2000::/3 is eligible. Exclude special-use, documentation,
  // transition, multicast, link-local, unique-local, unspecified, and loopback ranges.
  if (groups[0] < 0x2000 || groups[0] > 0x3fff) return true;
  if (groups[0] === 0x2001 && (groups[1] <= 0x01ff || groups[1] === 0x0db8)) return true;
  if (groups[0] === 0x2002) return true; // 6to4 embeds IPv4
  return false;
}

async function resolvePublicTarget(rawUrl, { httpsOnly = false, allowedHosts = null } = {}) {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol) || (httpsOnly && url.protocol !== "https:")) {
    throw new Error("blocked URL protocol");
  }
  if (url.username || url.password) throw new Error("URL credentials are blocked");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (!host || host.includes(" ") || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "metadata.google.internal") {
    throw new Error("blocked or invalid host: " + host);
  }
  if (allowedHosts && !allowedHosts.includes(host)) throw new Error("host is not allowlisted: " + host);
  let addresses;
  const literalFamily = net.isIP(host);
  try {
    addresses = literalFamily
      ? [{ address: host, family: literalFamily }]
      : await dns.promises.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error("host did not resolve: " + host);
  }
  if (!addresses.length || addresses.some((x) => ipIsPrivate(x.address))) {
    throw new Error("blocked private, reserved, or mixed DNS target: " + host);
  }
  return { url, address: addresses[0] };
}

async function validateUrl(rawUrl) {
  const target = await resolvePublicTarget(rawUrl);
  return target.url;
}

function rawGet(target, timeoutMs = TIMEOUT_MS, maxBytes = MAX_BODY) {
  const u = target.url;
  return new Promise((resolve, reject) => {
    const lib = u.protocol === "https:" ? https : http;
    let settled = false;
    const finish = (fn, value) => { if (!settled) { settled = true; fn(value); } };
    const lookup = (_host, options, callback) => {
      if (options && options.all) return callback(null, [{ address: target.address.address, family: target.address.family }]);
      return callback(null, target.address.address, target.address.family);
    };
    const req = lib.get(
      u,
      { lookup, headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8", "Accept-Language": "en" } },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          let next;
          try { next = new URL(res.headers.location, u); }
          catch { return finish(reject, new Error("bad redirect")); }
          if (next.protocol !== "http:" && next.protocol !== "https:") return finish(reject, new Error("blocked redirect protocol"));
          return finish(resolve, { redirected: next, res });
        }
        const declared = Number(res.headers["content-length"] || 0);
        if (declared > maxBytes) {
          res.destroy();
          return finish(reject, new Error("response exceeds size limit"));
        }
        const chunks = [];
        let len = 0;
        res.on("data", (chunk) => {
          len += chunk.length;
          if (len > maxBytes) {
            res.destroy();
            return finish(reject, new Error("response exceeds size limit"));
          }
          chunks.push(chunk);
        });
        res.on("end", () => finish(resolve, { res, body: Buffer.concat(chunks) }));
        res.on("error", (e) => finish(reject, e));
      }
    );
    req.on("error", (e) => finish(reject, e));
    req.setTimeout(timeoutMs, () => req.destroy(new Error("fetch timeout")));
  });
}

async function fetchPage(rawUrl, { maxRedirects = 3 } = {}) {
  let target;
  try { target = await resolvePublicTarget(rawUrl); }
  catch (e) { return { ok: false, error: e.message, url: rawUrl }; }
  let hops = 0;
  for (;;) {
    try {
      const out = await rawGet(target);
      if (out.redirected) {
        if (++hops > maxRedirects) return { ok: false, error: "too many redirects", url: rawUrl };
        try { target = await resolvePublicTarget(out.redirected.href); }
        catch (e) { return { ok: false, error: "redirect target blocked: " + e.message, url: rawUrl }; }
        continue;
      }
      if (out.res.statusCode >= 400) return { ok: false, error: `HTTP ${out.res.statusCode}`, url: target.url.href, status: out.res.statusCode };
      const ct = String(out.res.headers["content-type"] || "");
      if (ct.includes("application/json")) return { ok: true, url: target.url.href, status: out.res.statusCode, json: tryJson(out.body), body: out.body.toString("utf-8") };
      const html = out.body.toString("utf-8");
      const parsed = htmlToText(html);
      return { ok: true, url: target.url.href, status: out.res.statusCode, html, text: parsed.text, title: parsed.title, metaDate: parsed.metaDate, metaAuthor: parsed.metaAuthor, bytes: out.body.length };
    } catch (e) {
      return { ok: false, error: e.message, url: target.url.href };
    }
  }
}

async function downloadPublicBinary(rawUrl, { maxBytes = 8_000_000, allowedHosts = [], maxRedirects = 3 } = {}) {
  let target = await resolvePublicTarget(rawUrl, { httpsOnly: true, allowedHosts });
  for (let hops = 0; ; hops++) {
    const out = await rawGet(target, 30000, maxBytes);
    if (out.redirected) {
      if (hops >= maxRedirects) throw new Error("too many image redirects");
      target = await resolvePublicTarget(out.redirected.href, { httpsOnly: true, allowedHosts });
      continue;
    }
    if (out.res.statusCode < 200 || out.res.statusCode >= 300) throw new Error("image HTTP " + out.res.statusCode);
    const contentType = String(out.res.headers["content-type"] || "").split(";")[0].toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) throw new Error("unexpected image content type: " + contentType);
    return { url: target.url.href, contentType, body: out.body };
  }
}

function tryJson(buf) {
  try {
    return JSON.parse(buf.toString("utf-8"));
  } catch {
    return null;
  }
}

// Extract readable text + title + publish-date hints from HTML (evidence, not rendering).
function htmlToText(html) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
  const metaDate =
    (html.match(/<meta[^>]+(?:property|name)="(?:article:published_time|date|publishdate|pubdate)"[^>]+content="([^"]+)"/i) ||
      html.match(/<meta[^>]+content="([^"]+)"[^>]+(?:property|name)="(?:article:published_time|date|publishdate|pubdate)"/i) ||
      [])[1] ||
    null;
  const metaAuthor =
    (html.match(/<meta[^>]+(?:property|name)="(?:article:author|author)"[^>]+content="([^"]+)"/i) ||
      html.match(/<meta[^>]+content="([^"]+)"[^>]+(?:property|name)="(?:article:author|author)"/i) ||
      [])[1] ||
    null;
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const text = body
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return { text, title: title.replace(/\s+/g, " ").trim(), metaDate, metaAuthor };
}

// DuckDuckGo HTML search (keyless). POST form avoids the 202 anti-bot page GETs get.
// DDG intermittently returns 202 (rate-limited) — retry with backoff before failing.
// If /html/ stays rate-limited, fall back to /lite/ (same keyless service, different endpoint).
async function ddgSearchOnce(query, { max = 10, lite = false } = {}) {
  const payload = new URLSearchParams({ q: query });
  const lib = https;
  const data = payload.toString();
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        method: "POST",
        hostname: lite ? "lite.duckduckgo.com" : "html.duckduckgo.com",
        path: lite ? "/lite/" : "/html/",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(data), "User-Agent": UA },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, html: Buffer.concat(chunks).toString("utf-8"), lite }));
      }
    );
    req.on("error", reject);
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error("search timeout")));
    req.write(data);
    req.end();
  });
}
async function ddgSearch(query, { max = 10, attempts = 3, baseDelayMs = 2500 } = {}) {
  let out = null;
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      out = await ddgSearchOnce(query, { max });
      if (out.status === 200) break;
      lastErr = new Error(`DDG HTTP ${out.status}`);
      if (out.status === 403 || out.status === 404) break; // not transient
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1) + Math.floor(Math.random() * 1000)));
  }
  // Fallback endpoint when /html/ is rate-limited.
  if (!out || out.status !== 200) {
    try {
      const liteOut = await ddgSearchOnce(query, { max, lite: true });
      if (liteOut.status === 200) out = liteOut;
      else lastErr = new Error(`DDG HTTP ${liteOut.status}`);
    } catch (e) {
      lastErr = e;
    }
  }
  if (!out || out.status !== 200) throw lastErr || new Error("DDG request failed");
  const items = [];
  if (out.lite) {
    // /lite/ markup: <a rel="nofollow" href="URL" class='result-link'>title</a>
    // followed by a <td class='result-snippet'> row with <b> emphasis marks.
    // Match whole anchors (href precedes the class attribute in this markup).
    const anchors = [...out.html.matchAll(/<a[^>]+href="([^"]+)"[^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>/g)];
    for (let i = 0; i < anchors.length; i++) {
      let href = anchors[i][1];
      const uu = href.match(/uddg=([^&]+)/);
      if (uu) href = decodeURIComponent(uu[1]);
      const tail = out.html.slice(anchors[i].index, anchors[i].index + 5000);
      const s = tail.slice(anchors[i][0].length).match(/class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/);
      const clean = (x) => String(x || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
      try {
        const test = new URL(href);
        if (!["http:", "https:"].includes(test.protocol)) continue;
      } catch {
        continue;
      }
      items.push({ url: href, title: clean(anchors[i][2]), snippet: s ? clean(s[1]) : "" });
      if (items.length >= max) break;
    }
    return items;
  }
  // Split on the result anchor itself (robust to DDG markup drift): each chunk
  // starts with one result's <a class="result__a" ...>title</a> plus its snippet.
  const chunks = out.html.split(/<a[^>]+class="result__a"/);
  for (const b of chunks.slice(1)) {
    const a = b.match(/^[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    let href = a[1];
    const uu = href.match(/uddg=([^&]+)/);
    if (uu) href = decodeURIComponent(uu[1]);
    const tail = b.slice(0, 4000); // snippet lives right after the anchor
    const s = tail.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/) || tail.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div|td)>/);
    const clean = (x) => String(x || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
    try {
      const test = new URL(href);
      if (!["http:", "https:"].includes(test.protocol)) continue;
    } catch {
      continue;
    }
    items.push({ url: href, title: clean(a[2]), snippet: s ? clean(s[1]) : "" });
    if (items.length >= max) break;
  }
  return items;
}

module.exports = { fetchPage, downloadPublicBinary, ddgSearch, validateUrl, htmlToText, ipIsPrivate, MAX_BODY };
