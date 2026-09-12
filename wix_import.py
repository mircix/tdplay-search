#!/usr/bin/env python3
"""Index the old Wix TDPlay sites (2020–2023) into wix.json.

Wix assembles each page from a per-page JSON that lists every component with its
props (video URLs, rich-text captions, image links). This script:

  1. crawls the year hubs for their monthly pages (the sites have no sitemap),
  2. reads each page's id from its HTML and fetches that page's component JSON,
  3. pairs each video with its caption, initials and Apple Music / Spotify icons by
     position (element rectangles come from wix_rects.json, captured once in a
     browser because Wix computes its layout at runtime),
  4. for the 2020 pages – whose POWR video widgets are dead – recovers artist, song
     and artwork from the slot's Spotify link (Spotify's embed page, no API key).

Stdlib only.  python3 wix_import.py   ->   wix.json   (merged by build_index.py)
The Wix sites are archives, so this only needs re-running if they change.
"""
import html
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from urllib.parse import urlparse

from build_index import fetch, icon_kind, split_artist, month_label, text_of, yt_id

HUBS = [
    "https://mrxsp08.wixsite.com/tdplay23/tdplay23",
    "https://mrxsp08.wixsite.com/tdplay22/tdplay22",
    "https://mrxsp08.wixsite.com/tdplay21/tdplay21",
    "https://mrxsp08.wixsite.com/tdplay22/tdplay20",
]
HOST = "https://mrxsp08.wixsite.com"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "wix.json")
TITLE_RE = re.compile(r"TDPlay -([A-Za-z]+)'(\d\d) \(PG\.?(\d+)\)")
POWR_UI = "136e7553-1693-f7de-7752-ac74d3eafbb7"      # "Image + Video Slider by POWR"


# ---------------------------------------------------------------- discovery

def crawl_urls(known=()):
    """Follow same-site links from the hubs (plus any known URLs); returns {url: html}."""
    seen, queue, pages = set(), list(HUBS) + list(known), {}
    while queue:
        u = queue.pop(0)
        if u in seen:
            continue
        seen.add(u)
        body = None
        for attempt in range(6):
            try:
                status, body, _ = fetch(u)
                break
            except Exception as e:
                wait = 20 * (attempt + 1) if "429" in str(e) else 3 * (attempt + 1)
                print(f"  ! {u}: {e} (attempt {attempt + 1}, retry in {wait}s)", file=sys.stderr)
                time.sleep(wait)
        if not body or "<title>404" in body[:2000]:
            continue
        pages[u] = body
        site = u.split("/")[3]
        for link in set(re.findall(r'href="(' + re.escape(HOST) + "/" + site + r'/[^"#?]*)"', body)):
            if link not in seen:
                queue.append(link)
        print(f"  {len(pages):3} {u.replace(HOST + '/', '')}")
    return pages


# ------------------------------------------------------------ page JSON

def viewer_model(page_html):
    m = re.search(r'<script[^>]*id="wix-viewer-model"[^>]*>(.*?)</script>', page_html, flags=re.S)
    return json.loads(m.group(1)) if m else {}


def page_id(page_html):
    ids = re.findall(r'<style id="css_([A-Za-z0-9]+)"', page_html)
    ids = [i for i in ids if i != "masterPage"]
    return ids[0] if ids else ""


def features_url(page_html, json_name):
    urls = [u.replace("&amp;", "&") for u in
            re.findall(r'https://siteassets\.parastorage\.com/pages/pages/thunderbolt[^"\' <]*', page_html)]
    tpl = next((u for u in urls if "module=thunderbolt-features" in u), None)
    if not tpl:
        return None
    return re.sub(r"pageId=[^&]*", "pageId=" + json_name + ".json", tpl)


def page_json(url, page_html):
    pid = page_id(page_html)
    vm = viewer_model(page_html)
    pm = vm.get("siteFeaturesConfigs", {}).get("router", {}).get("pagesMap", {})
    entry = pm.get(pid) or {}
    fu = features_url(page_html, entry.get("pageJsonFileName", ""))
    if not (pid and entry and fu):
        return None
    for attempt in range(3):
        try:
            status, body, _ = fetch(fu)
            return json.loads(body)
        except Exception:
            time.sleep(3 * (attempt + 1))
    return None


# ------------------------------------------------------------ extraction

def link_of(props):
    l = props.get("link") if isinstance(props, dict) else None
    return (l or {}).get("href", "") if isinstance(l, dict) else ""


def rich_text(props):
    return text_of((props or {}).get("html", ""))


def rich_link(props):
    m = re.search(r'href="([^"]*)"', (props or {}).get("html", ""))
    return html.unescape(m.group(1)) if m else ""


def box(r):
    x, y, w, h = r
    return {"top": y, "left": x, "w": w, "h": h, "cx": x + w / 2, "bottom": y + h}


def page_items(pj, rects):
    """Pair every video (or dead POWR widget) with its caption, initials and icon
    links by position – the same slot geometry as the Hostinger pages."""
    comps = pj.get("structure", {}).get("components", {})
    props = pj.get("props", {}).get("render", {}).get("compProps", {})
    videos, texts, links = [], [], []
    for cid, c in comps.items():
        r = rects.get(cid)
        if not r:
            continue
        b, t, pr = box(r), c.get("componentType"), props.get(cid) or {}
        if t == "VideoPlayer":
            videos.append((b, yt_id(pr.get("src", "")) or yt_id(pr.get("videoUrl", "")), cid, False))
        elif t == "TPAWidget" and (pr.get("widgetId") == POWR_UI or "136e7544" in str(pr.get("appDefinitionId", ""))):
            videos.append((b, "", cid, True))                  # dead slider widget – no video id
        elif t == "WRichText":
            txt = rich_text(pr)
            if txt:
                texts.append((b, txt, rich_link(pr)))
        elif t == "WPhoto":
            href = link_of(pr)
            if href:
                links.append((b, href))
    videos.sort(key=lambda v: (v[0]["top"], v[0]["left"]))
    if not videos:
        return []

    def overlaps(b, vb):
        return abs(b["cx"] - vb["cx"]) <= max(vb["w"] * 0.75, 120)

    def video_above(b, reach=130):
        """The video this element sits directly under (captions) – nearest column wins."""
        best = None
        for i, (vb, *_) in enumerate(videos):
            gap, dx = b["top"] - vb["bottom"], abs(b["cx"] - vb["cx"])
            if overlaps(b, vb) and -10 <= gap <= reach and (best is None or dx < best[1]):
                best = (i, dx)
        return best[0] if best else None

    def video_below(b, reach=200):
        """The video this element sits directly above (initials, icons) – nearest column wins."""
        best = None
        for i, (vb, *_) in enumerate(videos):
            gap, dx = vb["top"] - b["bottom"], abs(b["cx"] - vb["cx"])
            if overlaps(b, vb) and -45 <= gap <= reach and (best is None or dx < best[1]):
                best = (i, dx)
        return best[0] if best else None

    def video_around(b):
        """The big featured embed whose box contains this element."""
        for i, (vb, *_) in enumerate(videos):
            if vb["w"] > 600 and vb["left"] - 20 <= b["cx"] <= vb["left"] + vb["w"] + 220 \
                    and vb["top"] - 5 <= b["top"] <= vb["bottom"] - 20:
                return i
        return None

    items = [{"yt": yt, "caption": "", "initials": "", "site": "", "apple": "", "spotify": "",
              "youtube": "", "anchor": cid, "featured": vb["w"] > 600, "dead": dead}
             for vb, yt, cid, dead in videos]
    for b, txt, href in texts:
        i = video_around(b)
        if i is not None:                                        # labels over the big embed
            it = items[i]
            if len(txt) <= 8 and not it["initials"]:
                it["initials"], it["site"] = txt, href
            elif 8 < len(txt) <= 40:
                it["alt"] = (it.get("alt", "") + " | " + txt).strip(" |")
            continue
        if len(txt) <= 8:
            i = video_below(b)
            if i is not None and not items[i]["featured"] and not items[i]["initials"]:
                items[i]["initials"], items[i]["site"] = txt, href
        else:
            i = video_above(b)
            if i is not None and not items[i]["featured"] and not items[i]["caption"]:
                items[i]["caption"] = txt
    for b, href in links:
        kind = icon_kind("", href)
        if not kind or b["w"] > 300:
            continue
        i = video_around(b)
        if i is None:
            i = video_below(b)
        if i is None:
            continue
        it = items[i]
        if kind == "youtube" and yt_id(href) == it["yt"]:
            continue
        if kind == "apple" and it["apple"] and "/album/" in it["apple"] and "/album/" not in href:
            continue
        if not it[kind] or kind == "apple":
            it[kind] = href
    for it in items:
        it.pop("_cap", None)
        it.pop("_ini", None)
        if not it["featured"]:
            it.pop("featured")
        it["artist"], it["title"] = split_artist(it["caption"])
    return items


def playlists(pj):
    out = {}
    for p in pj.get("props", {}).get("render", {}).get("compProps", {}).values():
        h = link_of(p) if isinstance(p, dict) else ""
        if "open.spotify.com/playlist" in h:
            out.setdefault("spotify", h)
        elif "music.apple.com" in h and "/playlist/" in h:
            out.setdefault("apple", h)
        elif ("youtube.com" in h or "youtu.be" in h) and "list=" in h and "watch" in h:
            out.setdefault("youtube", h)
    return out


# ------------------------------------------------------ dead POWR widgets (2020)

LOOKUP_CACHE = os.path.join(HERE, "wix_tracks.json")


def spotify_id(url):
    m = re.search(r"open\.spotify\.com/(?:embed/)?track/([A-Za-z0-9]+)", url or "")
    return m.group(1) if m else ""


def spotify_lookup(track_id):
    """Artist / title / artwork from Spotify's tiny embed page (no API key needed)."""
    try:
        status, body, _ = fetch("https://open.spotify.com/embed/track/" + track_id, retries=2)
        m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', body, flags=re.S)
        ent = json.loads(m.group(1))["props"]["pageProps"]["state"]["data"]["entity"]
        imgs = (ent.get("visualIdentity") or {}).get("image") or []
        imgs = sorted(imgs, key=lambda i: i.get("maxWidth", 0))
        return {"artist": ", ".join(a.get("name", "") for a in ent.get("artists", []) if a.get("name")),
                "title": ent.get("name", ""),
                "thumb": next((i["url"] for i in imgs if i.get("maxWidth", 0) >= 300), imgs[-1]["url"] if imgs else "")}
    except Exception:
        return None


def resolve_dead(dead, cache):
    """Fill captions for slots whose video widget is dead, from their Spotify link."""
    todo = [i for i in dead if spotify_id(i.get("spotify", "")) and spotify_id(i["spotify"]) not in cache]
    ids = list(dict.fromkeys(spotify_id(i["spotify"]) for i in todo))
    for n, tid in enumerate(ids):
        cache[tid] = spotify_lookup(tid)
        if n % 50 == 49:
            print(f"  spotify lookups: {n + 1}/{len(ids)}")
        time.sleep(0.25)
    for it in dead:
        info = cache.get(spotify_id(it.get("spotify", "")))
        if info and info.get("artist"):
            it["caption"] = f'{info["artist"]} - {info["title"]}'
            it["artist"], it["title"], it["thumb"] = info["artist"], info["title"], info["thumb"]


# -------------------------------------------------------------------- main

RECTS = os.path.join(HERE, "wix_rects.json")   # element positions, exported once from a browser


def main():
    with open(RECTS, encoding="utf-8") as f:
        rects_by_url = {r["url"]: r["rects"] for r in json.load(f)}
    print("discovering pages…")
    pages = crawl_urls(known=rects_by_url.keys())
    print(f"{len(pages)} pages found; fetching page data…")

    def work(item):
        url, body = item
        m = TITLE_RE.search(re.search(r"<title>([^<]*)</title>", body).group(1) if "<title>" in body else "")
        if not m:
            return None                                   # year hubs, tools pages…
        try:
            pj = page_json(url, body)
        except Exception as e:
            print(f"  ! {url}: {e}", file=sys.stderr)
            return None
        if not pj or url not in rects_by_url:
            return None
        items = page_items(pj, rects_by_url[url])
        if not items:
            return None
        mon, yy, pg = m.group(1), m.group(2), int(m.group(3))
        entry = {"slug": f"tdplay-{mon.lower()}{yy}-pg{pg}", "url": url,
                 "name": f"TDPlay -{mon}'{yy} [PG.{pg}]", "title": html.unescape(m.group(0)),
                 "source": "wix", "items": items, "playlists": playlists(pj), "page": pg}
        entry["month"] = month_label(entry)
        return entry

    results = []
    with ThreadPoolExecutor(max_workers=4) as ex:
        for e in ex.map(work, pages.items()):
            if e:
                results.append(e)
                print(f"  {e['name']:32} {len(e['items']):3} slots, "
                      f"{sum(1 for i in e['items'] if i['yt'])} videos")

    dead = [i for p in results for i in p["items"] if i.get("dead")]
    print(f"dead widgets to resolve via Spotify: {len(dead)}")
    cache = {}
    if os.path.exists(LOOKUP_CACHE):
        with open(LOOKUP_CACHE, encoding="utf-8") as f:
            cache = json.load(f)
    resolve_dead(dead, cache)
    with open(LOOKUP_CACHE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False)
    for p in results:
        p["items"] = [i for i in p["items"] if i["yt"] or i["caption"]]   # drop empty dead slots
        for it in p["items"]:
            it.pop("dead", None)

    total = sum(len(p["items"]) for p in results)
    out = {"generated": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
           "source": HOST, "pageCount": len(results), "itemCount": total, "pages": results}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote wix.json: {len(results)} pages, {total} slots, "
          f"{sum(1 for p in results for i in p['items'] if i['yt'])} with a video, "
          f"{sum(1 for p in results for i in p['items'] if not i['caption'])} without a caption")


if __name__ == "__main__":
    main()
