#!/usr/bin/env python3
"""Stage 01: capture the live Folkly site baseline into docs/preservation/.

Fetches every route (both extensionless and .html forms), records status codes,
final URLs, response headers, full HTML, and extracts visible text + asset
inventory. Writes docs/preservation/inventory.md, pages/<slug>.md, and
raw/ for the HTML. No modifications to the live site (GET requests only).
"""
import json
import re
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

BASE = "https://folkly-journal.nrapp.chatgpt.site"
REPO = Path("C:/Users/noaha/Folk")
PRES = REPO / "docs" / "preservation"
PAGES_DIR = PRES / "pages"
RAW_DIR = PRES / "raw"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

ROUTES = [
    "/",
    "/perspective", "/perspective.html",
    "/about", "/about.html",
    "/new-orleans-second-line", "/new-orleans-second-line.html",
    "/lisbon-fado", "/lisbon-fado.html",
    "/oaxaca-living-color", "/oaxaca-living-color.html",
    "/detroit-future-frequency", "/detroit-future-frequency.html",
    "/index.html",
]

SKIP_TAGS = {"script", "style", "noscript", "template", "head"}
VOID_TAGS = {"meta", "link", "img", "br", "hr", "input", "source"}


class TextExtractor(HTMLParser):
    """Extract visible text, meta info, and referenced assets."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.text_parts = []
        self.skip_depth = 0
        self.title = ""
        self.in_title = False
        self.metas = {}
        self.jsonld = []
        self.in_jsonld = False
        self.jsonld_buf = []
        self.headings = []
        self.in_h = 0
        self.h_buf = []
        self.links = []
        self.assets = set()
        self.images = []  # (src, alt)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "link" and "stylesheet" in (a.get("rel") or "") and a.get("href"):
            self.assets.add(a["href"])
        if tag in VOID_TAGS:
            if tag == "meta":
                name = (a.get("name") or a.get("property") or "").lower()
                if name:
                    self.metas[name] = a.get("content", "")
            if tag == "img":
                src = a.get("src", "")
                if src:
                    self.assets.add(src)
                self.images.append((src, a.get("alt", "")))
            return
        if tag in SKIP_TAGS:
            self.skip_depth += 1
            return
        if tag == "title":
            self.in_title = True
        elif tag == "meta":
            name = (a.get("name") or a.get("property") or "").lower()
            if name:
                self.metas[name] = a.get("content", "")
        elif tag == "script" and a.get("type") == "application/ld+json":
            self.in_jsonld = True
            self.jsonld_buf = []
        elif tag in ("h1", "h2", "h3", "h4"):
            self.in_h = int(tag[1])
            self.h_buf = []
        elif tag == "a" and a.get("href"):
            self.links.append(a["href"])
        elif tag == "img":
            src = a.get("src", "")
            if src:
                self.assets.add(src)
            self.images.append((src, a.get("alt", "")))

    def handle_endtag(self, tag):
        if tag in SKIP_TAGS:
            self.skip_depth = max(0, self.skip_depth - 1)
            return
        if tag == "title":
            self.in_title = False
        elif tag == "script" and self.in_jsonld:
            self.in_jsonld = False
            self.jsonld.append("".join(self.jsonld_buf))
        elif tag in ("h1", "h2", "h3", "h4") and self.in_h == int(tag[1]):
            self.in_h = 0
            t = "".join(self.h_buf).strip()
            if t:
                self.headings.append((int(tag[1]), t))

    def handle_startendtag(self, tag, attrs):
        # self-closing form: route void content handling, no depth change
        if tag == "meta":
            a = dict(attrs)
            name = (a.get("name") or a.get("property") or "").lower()
            if name:
                self.metas[name] = a.get("content", "")
        elif tag == "link" and "stylesheet" in (dict(attrs).get("rel") or ""):
            if attrs and dict(attrs).get("href"):
                self.assets.add(dict(attrs)["href"])
        elif tag == "img":
            a = dict(attrs)
            src = a.get("src", "")
            if src:
                self.assets.add(src)
            self.images.append((src, a.get("alt", "")))

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        if self.in_jsonld:
            self.jsonld_buf.append(data)
        if self.skip_depth:
            return
        if self.in_h:
            self.h_buf.append(data)
        self.text_parts.append(data)

    @property
    def text(self):
        out = []
        for p in self.text_parts:
            p = re.sub(r"[ \t]+", " ", p).strip()
            if p:
                out.append(p)
        return "\n\n".join(out)


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        body = resp.read().decode("utf-8", errors="replace")
        return {
            "status": resp.status,
            "final_url": resp.geturl(),
            "headers": {k.lower(): v for k, v in resp.headers.items()},
            "body": body,
            "error": None,
        }
    except urllib.error.HTTPError as e:
        return {"status": e.code, "final_url": url, "headers": {}, "body": "", "error": str(e)}
    except Exception as e:
        return {"status": None, "final_url": url, "headers": {}, "body": "", "error": str(e)}


def main():
    for d in (PRES, PAGES_DIR, RAW_DIR):
        d.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat()
    inventory = {
        "captured_at": now,
        "base_url": BASE,
        "sites_project_id": "appgprj_6abfc9a424f881918070e39a237ecc83",
        "sites_tools_available": False,
        "routes": {},
        "all_assets": set(),
    }
    for route in ROUTES:
        url = BASE + route
        r = fetch(url)
        slug = (route.strip("/") or "index").replace(".html", "")
        if route == "/":
            slug = "index"
        inv = {
            "route": route,
            "status": r["status"],
            "final_url": r["final_url"],
            "error": r["error"],
        }
        if r["status"] == 200 and r["body"]:
            p = TextExtractor()
            try:
                p.feed(r["body"])
            except Exception as e:
                inv["parse_error"] = str(e)
            inv["title"] = p.title.strip()
            inv["metas"] = {k: v for k, v in p.metas.items()
                            if k in ("description", "og:title", "og:description",
                                     "og:image", "twitter:card")}
            inv["jsonld_count"] = len(p.jsonld)
            inv["jsonld"] = [json.loads(x) for x in p.jsonld if x.strip()]
            inv["headings"] = p.headings
            inv["images"] = p.images
            inv["text_len"] = len(p.text)
            inventory["all_assets"].update(p.assets)
            # save raw html
            (RAW_DIR / f"{slug}.html").write_text(r["body"], encoding="utf-8")
            # save extracted page capture
            lines = [
                f"# Capture: {route}",
                f"",
                f"- captured_at: {now}",
                f"- status: {r['status']}",
                f"- final_url: {r['final_url']}",
                f"- title: {inv['title']}",
                f"- link_count: {len(p.links)}",
                f"",
                f"## Metadata",
                f"",
            ]
            for k, v in sorted(p.metas.items()):
                lines.append(f"- {k}: {v}")
            if p.jsonld:
                lines += ["", "## JSON-LD", ""]
                for j in p.jsonld:
                    lines.append("```json")
                    lines.append(json.dumps(json.loads(j), indent=2))
                    lines.append("```")
            lines += ["", "## Headings", ""]
            for lvl, t in p.headings:
                lines.append(f"- {'#' * lvl} {t}")
            lines += ["", "## Full visible text", ""]
            lines.append(p.text)
            (PAGES_DIR / f"{slug}.md").write_text("\n".join(lines), encoding="utf-8")
        # key response headers of note
        h = r.get("headers", {})
        inv["content_type"] = h.get("content-type", "")
        inv["server"] = h.get("server", "")
        inventory["routes"][route] = inv
        print(f"{route:35s} -> {r['status']} final={r['final_url']}")

    # asset inventory: fetch headers for each asset (size/type only)
    for asset in sorted(inventory["all_assets"]):
        url = asset if asset.startswith("http") else (BASE + "/" + asset.lstrip("/"))
        r = fetch(url)
        h = r.get("headers", {})
        inventory.setdefault("assets", {})[asset] = {
            "status": r["status"],
            "content_type": h.get("content-type", ""),
            "content_length": h.get("content-length", ""),
        }
        print(f"asset {asset:40s} -> {r['status']} {h.get('content-length','?')}")

    inventory["all_assets"] = sorted(inventory["all_assets"])

    # write inventory.md
    inv_lines = [
        "# Folkly Live Site Inventory (Stage 01 baseline)",
        "",
        f"- Captured: {now} (UTC)",
        f"- Base URL: {BASE}",
        f"- Sites project ID: appgprj_6abfc9a424f881918070e39a237ecc83",
        f"- Sites tools available in this environment: **No** — baseline is from public HTTP only.",
        f"- Capture method: GET requests, no modification of the live site.",
        "",
        "## Routes",
        "",
        "| Route | Status | Final URL | Title |",
        "|-------|--------|-----------|-------|",
    ]
    for route, inv in inventory["routes"].items():
        inv_lines.append(
            f"| {route} | {inv['status']} | {inv['final_url']} | {inv.get('title','')} |"
        )
    inv_lines += ["", "## Assets", ""]
    for asset in inventory["all_assets"]:
        meta = inventory.get("assets", {}).get(asset, {})
        inv_lines.append(
            f"- `{asset}` — HTTP {meta.get('status')}, {meta.get('content_type')}, "
            f"{meta.get('content_length')} bytes"
        )
    inv_lines += [
        "",
        "## Per-route detail",
        "",
    ]
    for route, inv in inventory["routes"].items():
        if inv.get("jsonld"):
            inv_lines.append(f"### {route}")
            inv_lines.append(f"- title: {inv.get('title')}")
            inv_lines.append(f"- meta: {json.dumps(inv.get('metas', {}))}")
            inv_lines.append("- JSON-LD:")
            inv_lines.append("```json")
            inv_lines.append(json.dumps(inv["jsonld"], indent=2))
            inv_lines.append("```")
            inv_lines.append("")
    (PRES / "inventory.md").write_text("\n".join(inv_lines), encoding="utf-8")
    (PRES / "inventory.json").write_text(
        json.dumps(inventory, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"\nWrote {PRES / 'inventory.md'} and per-page captures to {PAGES_DIR}")


if __name__ == "__main__":
    main()
