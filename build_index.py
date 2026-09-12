#!/usr/bin/env python3
"""Build the TDPlay search index.

Discovers every published page from https://tdplay.site/sitemap.xml, downloads
only the pages that changed since the last run (conditional GET / ETag), decodes
the builder data that Hostinger embeds in each page, and writes:

  data.json   full crawl – every field, plus ETags so the next run is incremental
  index.json  lean search index the widget downloads (page, video id, caption, initials)
  links.json  per-video website / Apple Music / Spotify / YouTube links, loaded lazily
  status.json when the site was last checked

Stdlib only – no pip installs needed. Run:  python3 build_index.py
"""
import html
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from xml.etree import ElementTree

SITE = "https://tdplay.site"
SITEMAP = SITE + "/sitemap.xml"
HERE = os.path.dirname(os.path.abspath(__file__))
HEADERS = {
    # The CDN answers 403 to bare curl-style clients; look like a browser.
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/128.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def ssl_context():
    """Default certs, falling back to certifi / the OS bundle (python.org Macs
    often ship without root certificates wired up)."""
    ctx = ssl.create_default_context()
    if ctx.cert_store_stats().get("x509_ca", 0) > 0:
        return ctx
    candidates = []
    try:
        import certifi
        candidates.append(certifi.where())
    except ImportError:
        pass
    candidates += ["/etc/ssl/cert.pem", "/etc/ssl/certs/ca-certificates.crt"]
    for path in candidates:
        if os.path.exists(path):
            return ssl.create_default_context(cafile=path)
    return ctx


SSL_CTX = ssl_context()
MONTHS = ["january", "february", "march", "april", "may", "june", "july",
          "august", "september", "october", "november", "december"]


# ---------------------------------------------------------------- fetching

def fetch(url, etag=None, retries=3):
    """GET a URL. Returns (status, body_text, headers). 304 => body is None."""
    req = urllib.request.Request(url, headers=dict(HEADERS))
    if etag:
        req.add_header("If-None-Match", etag)
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as r:
                body = r.read()
                enc = r.headers.get("Content-Encoding", "")
                if "gzip" in enc:
                    import gzip
                    body = gzip.decompress(body)
                return r.status, body.decode("utf-8", "replace"), dict(r.headers)
        except urllib.error.HTTPError as e:
            if e.code == 304:
                return 304, None, dict(e.headers)
            if e.code in (429, 500, 502, 503, 504) and attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            raise
        except (urllib.error.URLError, TimeoutError):
            if attempt < retries - 1:
                time.sleep(2 * (attempt + 1))
                continue
            raise


def sitemap_urls():
    status, xml, _ = fetch(SITEMAP)
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    root = ElementTree.fromstring(xml)
    urls = []
    for u in root.findall("s:url", ns):
        loc = u.findtext("s:loc", default="", namespaces=ns).strip()
        mod = u.findtext("s:lastmod", default="", namespaces=ns).strip()
        if loc:
            urls.append((loc, mod))
    return urls


# ---------------------------------------------------------- Astro props

def decode_props(v):
    """Undo Astro's [type, value] prop serialisation."""
    if isinstance(v, list) and len(v) in (1, 2) and isinstance(v[0], int) and 0 <= v[0] <= 8:
        t = v[0]
        x = v[1] if len(v) == 2 else None
        if isinstance(x, str) and t in (1, 4, 5):
            try:
                x = json.loads(x)
            except ValueError:
                pass
        if t == 0:
            return {k: decode_props(val) for k, val in x.items()} if isinstance(x, dict) else x
        if t in (1, 5):
            return [decode_props(i) for i in x]
        if t == 4:
            return {decode_props(k): decode_props(val) for k, val in x}
        return x
    if isinstance(v, dict):
        return {k: decode_props(val) for k, val in v.items()}
    if isinstance(v, list):
        return [decode_props(i) for i in v]
    return v


def page_data(html_text):
    """Pull pageData out of the <astro-island> that renders the page."""
    for m in re.finditer(r"<astro-island\b([^>]*)>", html_text):
        attrs = m.group(1)
        if "Page." not in attrs:
            continue
        pm = re.search(r'props="([^"]*)"', attrs)
        if not pm:
            continue
        props = decode_props(json.loads(html.unescape(pm.group(1))))
        pd = props.get("pageData")
        if pd:
            return pd
    return None


# ------------------------------------------------------------ extraction

TAG_RE = re.compile(r"<[^>]+>")
HREF_RE = re.compile(r'href="([^"]*)"')
YT_ID_RE = re.compile(r"(?:embed/|v=|vi/|youtu\.be/)([A-Za-z0-9_-]{11})")
WS_RE = re.compile(r"\s+")


def text_of(content):
    s = TAG_RE.sub(" ", content or "")
    s = html.unescape(s).replace("‪", "").replace("‬", "").replace("\xa0", " ")
    return WS_RE.sub(" ", s).strip()


def first_href(content):
    m = HREF_RE.search(content or "")
    return html.unescape(m.group(1)) if m else ""


def yt_id(s):
    m = YT_ID_RE.search(s or "")
    return m.group(1) if m else ""


def icon_kind(path):
    p = (path or "").lower()
    if "apple" in p:
        return "apple"
    if "spotify" in p:
        return "spotify"
    if "youtube" in p and "back-plate" not in p:
        return "youtube"
    return ""


def box(el):
    d = el.get("desktop") or {}
    top, left = d.get("top"), d.get("left")
    w, h = d.get("width") or 0, d.get("height") or 0
    if top is None or left is None:
        return None
    return {"top": top, "left": left, "w": w, "h": h,
            "cx": left + w / 2, "bottom": top + h}


def split_artist(caption):
    """Best-effort 'Artist - Title' split for display. Returns (artist, title)."""
    for sep in (" - ", " – ", " — ", " | ", " -", "- "):
        if sep in caption:
            a, t = caption.split(sep, 1)
            a, t = a.strip(), t.strip()
            if 0 < len(a) <= 45 and t:
                return a, t
    return "", caption


def block_items(block, elements, block_id):
    comps = [elements.get(cid) for cid in block.get("components", [])]
    comps = [c for c in comps if c]
    videos, texts, icons = [], [], []
    for el in comps:
        b = box(el)
        if not b:
            continue
        t = el.get("type")
        st = el.get("settings") or {}
        if t == "GridVideo":
            vid = yt_id(st.get("src")) or yt_id(st.get("jpg")) or yt_id(st.get("webp"))
            if vid:
                videos.append((b, vid))
        elif t == "GridTextBox":
            txt = text_of(el.get("content"))
            if txt:
                texts.append((b, txt, first_href(el.get("content"))))
        elif t == "GridImage":
            kind = icon_kind(st.get("path"))
            if kind and el.get("href"):
                icons.append((b, kind, el["href"]))
    if not videos:
        return []
    videos.sort(key=lambda v: v[0]["left"])

    def column_of(b):
        """Index of the video whose column this element sits in, or None."""
        best, best_d = None, None
        for i, (vb, _) in enumerate(videos):
            d = abs(b["cx"] - vb["cx"])
            if d <= max(vb["w"] * 0.75, 120) and (best_d is None or d < best_d):
                best, best_d = i, d
        return best

    items = [{"yt": vid, "caption": "", "initials": "", "site": "",
              "apple": "", "spotify": "", "youtube": ""} for _, vid in videos]
    for b, txt, href in texts:
        i = column_of(b)
        if i is None:
            continue
        vb = videos[i][0]
        if b["top"] >= vb["top"] + vb["h"] * 0.5:
            # below the video => caption (nearest one wins)
            if not items[i]["caption"] or b["top"] < items[i].get("_cap_top", 1e9):
                items[i]["caption"] = txt
                items[i]["_cap_top"] = b["top"]
        elif b["bottom"] <= vb["top"] + 10:
            # above the video => initials label (nearest one wins)
            if not items[i]["initials"] or b["bottom"] > items[i].get("_ini_bot", -1e9):
                items[i]["initials"] = txt
                items[i]["site"] = href
                items[i]["_ini_bot"] = b["bottom"]
    for b, kind, href in icons:
        i = column_of(b)
        if i is None:
            continue
        vb = videos[i][0]
        if b["top"] < vb["top"] + vb["h"] * 0.5:
            items[i][kind] = href
    anchor = block.get("htmlId") or ""
    out = []
    for it in items:
        it.pop("_cap_top", None)
        it.pop("_ini_bot", None)
        artist, title = split_artist(it["caption"])
        it["artist"] = artist
        it["title"] = title
        if anchor:
            it["anchor"] = anchor
        out.append(it)
    return out


def playlist_links(blocks, elements, page):
    """Month playlist links from the hero (Spotify / Apple Music / YouTube)."""
    links = {}
    for bid in page.get("blocks", []):
        for cid in blocks.get(bid, {}).get("components", []):
            el = elements.get(cid) or {}
            href = el.get("href") or ""
            if el.get("type") != "GridImage" or not href:
                continue
            if "open.spotify.com/playlist" in href:
                links.setdefault("spotify", href)
            elif "music.apple.com" in href and "/playlist/" in href:
                links.setdefault("apple", href)
            elif ("youtube.com" in href or "youtu.be" in href) and "list=" in href:
                links.setdefault("youtube", href)
    return links


def parse_page(url, html_text, etag, lastmod):
    pd = page_data(html_text)
    slug = url.replace(SITE, "").strip("/") or "home"
    tm = re.search(r"<title>([^<]*)</title>", html_text)
    title = html.unescape(tm.group(1)).strip() if tm else ""
    entry = {"slug": slug, "url": url, "name": title.split(" | ")[0].strip() or slug,
             "title": title, "etag": etag, "lastmod": lastmod, "items": []}
    if not pd:
        return entry
    pages, blocks, elements = pd.get("pages", {}), pd.get("blocks", {}), pd.get("elements", {})
    cur = next((p for p in pages.values() if p.get("slug") == slug and "blocks" in p), None) \
        or next((p for p in pages.values() if "blocks" in p), None)
    if not cur:
        return entry
    entry["name"] = cur.get("name") or entry["name"]
    for bid in cur.get("blocks", []):
        b = blocks.get(bid)
        if b:
            entry["items"].extend(block_items(b, elements, bid))
    entry["playlists"] = playlist_links(blocks, elements, cur)
    return entry


# ---------------------------------------------------------------- ordering

def sort_key(entry):
    """Newest month first, page 1 first within a month; non-month pages last."""
    m = re.match(r"tdplay-([a-z]+)(\d{2})-pg(\d+)$", entry["slug"])
    if not m:
        return (1, entry["slug"], 0)
    mon, yy, pg = m.group(1), int(m.group(2)), int(m.group(3))
    mi = MONTHS.index(mon) + 1 if mon in MONTHS else (12.5 if mon == "xmas" else 0)
    return (0, -(2000 + yy) * 100 - mi, pg)


def month_label(entry):
    m = re.match(r"tdplay-([a-z]+)(\d{2})-pg(\d+)$", entry["slug"])
    if not m:
        return entry["name"]
    mon, yy = m.group(1), m.group(2)
    return f"{mon.capitalize()}'{yy}"


# -------------------------------------------------------------------- main

DATA = os.path.join(HERE, "data.json")      # full crawl (source of truth + ETag state)
INDEX = os.path.join(HERE, "index.json")    # lean: what the search widget downloads
LINKS = os.path.join(HERE, "links.json")    # per-video links, loaded lazily by the widget
STATUS = os.path.join(HERE, "status.json")  # last-checked date (keeps the GitHub schedule alive)


def write_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    return os.path.getsize(path) // 1024


def main():
    previous = {}
    if os.path.exists(DATA):
        try:
            with open(DATA, encoding="utf-8") as f:
                previous = {p["slug"]: p for p in json.load(f).get("pages", [])}
        except (ValueError, KeyError):
            previous = {}

    urls = sitemap_urls()
    print(f"sitemap: {len(urls)} urls")

    def work(item):
        url, lastmod = item
        slug = url.replace(SITE, "").strip("/") or "home"
        prev = previous.get(slug)
        try:
            status, body, hdrs = fetch(url, etag=prev.get("etag") if prev else None)
        except Exception as e:  # keep the old entry rather than dropping the page
            print(f"  ! {slug}: {e}", file=sys.stderr)
            return prev, "error"
        if status == 304 and prev:
            return prev, "unchanged"
        etag = (hdrs.get("ETag") or hdrs.get("Etag") or "").strip()
        return parse_page(url, body, etag, lastmod), "fetched"

    results, counts = [], {"fetched": 0, "unchanged": 0, "error": 0}
    with ThreadPoolExecutor(max_workers=4) as ex:
        for entry, how in ex.map(work, urls):
            counts[how] += 1
            if entry:
                results.append(entry)
    for e in results:
        e["month"] = month_label(e)
        e["page"] = int(m.group(1)) if (m := re.search(r"-pg(\d+)$", e["slug"])) else 0
    results.sort(key=sort_key)

    generated = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    total_items = sum(len(p["items"]) for p in results)
    meta = {"generated": generated, "site": SITE, "pageCount": len(results), "itemCount": total_items}

    kb_data = write_json(DATA, dict(meta, pages=results))

    lean_pages, links = [], {}
    for p in results:
        lean_items = []
        for it in p["items"]:
            li = {"yt": it["yt"], "caption": it["caption"], "initials": it["initials"]}
            if it.get("anchor"):
                li["anchor"] = it["anchor"]
            lean_items.append(li)
            l = {k: it[k] for k in ("site", "apple", "spotify", "youtube") if it.get(k)}
            if l:
                links[p["slug"] + "/" + it["yt"]] = l
        lean = {"slug": p["slug"], "name": p["name"], "month": p["month"], "page": p["page"],
                "items": lean_items}
        if p.get("playlists"):
            lean["playlists"] = p["playlists"]
        lean_pages.append(lean)
    kb_index = write_json(INDEX, dict(meta, pages=lean_pages))
    kb_links = write_json(LINKS, {"generated": generated, "links": links})
    # Date-only so this changes at most once a day: a daily commit stops GitHub from
    # switching the scheduled workflow off after 60 days without repository activity.
    write_json(STATUS, {"lastChecked": generated[:10], "generated": generated,
                        "pageCount": len(results), "itemCount": total_items,
                        "fetched": counts["fetched"], "unchanged": counts["unchanged"],
                        "errors": counts["error"]})

    print(f"pages: {len(results)}  items: {total_items}  "
          f"(fetched {counts['fetched']}, unchanged {counts['unchanged']}, errors {counts['error']})")
    print(f"wrote data.json {kb_data} KB, index.json {kb_index} KB, links.json {kb_links} KB")
    return 0 if counts["error"] < len(urls) else 1


if __name__ == "__main__":
    sys.exit(main())
