"use strict";
// Stage 04 research layer: web search + retrieval of underlying pages/documents.
// All retrieved content is UNTRUSTED input: it is truncated, never executed, and only
// its text is used as evidence. Fetch destinations are validated; private/internal
// network targets are blocked; redirects are followed only to validated hosts.
const https = require("https");
const http = require("http");
const dns = require("dns");
const { URL } = require("url");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const MAX_BODY = 400_000; // bytes — enough for a full article, bounded for untrusted input
const TIMEOUT_MS = 20_000;

function ipIsPrivate(ip) {
  if (!ip) return true;
  if (ip === "::1" || ip === "127.0.0.1") return true;
  const m = ip.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?$/);
  if (!m) return true;
  const [a, b] = [parseInt(m[1]), parseInt(m[2] || "0")];
  if (a === 10 || a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // link-local
  if (a === 0 || a >= 224) return true; // loopback/multicast/reserved
  return false;
}

async function validateUrl(rawUrl) {
  const u = new URL(rawUrl);
  if (!["http:", "https:"].includes(u.protocol)) throw new Error(`blocked protocol: ${u.protocol}`);
  const host = u.hostname.toLowerCase().replace(/^\./, "").replace(/\.$/, "");
  if (!host || host.includes(" ")) throw new Error("invalid host");
  if (["localhost", "metadata.google.internal"].includes(host)) throw new Error("blocked host: " + host);
  // Resolve and block private/internal targets (SSRF guard)
  let addrs = [];
  try {
    const r = await dns.promises.resolve4(host);
    addrs = r;
  } catch {
    try {
      const r = await dns.promises.resolve6(host);
      addrs = r.map((x) => x.replace(/^.*:/, ""));
    } catch {
      throw new Error("host did not resolve: " + host);
    }
  }
  if (addrs.some(ipIsPrivate)) throw new Error(`blocked private/internal target: ${host} -> ${addrs.join(",")}`);
  return u;
}

function rawGet(u, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.get(
      u,
      { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8", "Accept-Language": "en" } },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          let next;
          try {
            next = new URL(res.headers.location, u);
          } catch {
            return reject(new Error("bad redirect"));
          }
          if (next.protocol !== "http:" && next.protocol !== "https:") return reject(new Error("blocked redirect protocol"));
          resolve({ redirected: next, res });
          return;
        }
        const chunks = [];
        let len = 0;
        res.on("data", (c) => {
          len += c.length;
          if (len <= MAX_BODY) chunks.push(c);
        });
        res.on("end", () => resolve({ res, body: Buffer.concat(chunks) }));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("fetch timeout")));
  });
}

// Fetch one public page with redirect validation (max 3 hops).
async function fetchPage(rawUrl, { maxRedirects = 3 } = {}) {
  let u;
  try {
    u = await validateUrl(rawUrl);
  } catch (e) {
    return { ok: false, error: e.message, url: rawUrl };
  }
  let hops = 0;
  for (;;) {
    try {
      const out = await rawGet(u);
      if (out.redirected) {
        if (++hops > maxRedirects) return { ok: false, error: "too many redirects", url: rawUrl };
        try {
          u = await validateUrl(out.redirected.href);
        } catch (e) {
          return { ok: false, error: "redirect target blocked: " + e.message, url: rawUrl };
        }
        continue;
      }
      if (out.res.statusCode >= 400) return { ok: false, error: `HTTP ${out.res.statusCode}`, url: u.href, status: out.res.statusCode };
      const ct = String(out.res.headers["content-type"] || "");
      if (ct.includes("application/json")) {
        return { ok: true, url: u.href, status: out.res.statusCode, json: tryJson(out.body), body: out.body.toString("utf-8").slice(0, MAX_BODY) };
      }
      const html = out.body.toString("utf-8");
      const parsed = htmlToText(html);
      return {
        ok: true,
        url: u.href,
        status: out.res.statusCode,
        html,
        text: parsed.text,
        title: parsed.title,
        metaDate: parsed.metaDate,
        metaAuthor: parsed.metaAuthor,
        bytes: out.body.length,
      };
    } catch (e) {
      return { ok: false, error: e.message, url: u.href };
    }
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

module.exports = { fetchPage, ddgSearch, validateUrl, htmlToText, ipIsPrivate, MAX_BODY };
