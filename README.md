# TDPlay Search

Instant search across **every page of tdplay.site** – artists, song titles, initials and
months – that keeps itself up to date when new pages are published.

## How it works

```
tdplay.site/sitemap.xml ──► build_index.py ──► index.json + links.json ──► search.js
   (Hostinger rewrites it       (runs on a schedule;        (static files on         (search box, on
    on every publish)            only re-downloads           GitHub Pages)            tdplay.site or the
                                 pages that changed)                                  standalone page)
```

1. **`build_index.py`** reads the sitemap, so any page you publish is discovered
   automatically. It decodes the builder data Hostinger embeds in each page and pulls out,
   for every video slot: the YouTube ID, caption, artist initials, the initials' website
   link, and the Apple Music / Spotify / YouTube icon links. The big **featured** video on
   each page has no caption on the site, so its title and channel are fetched from
   YouTube's keyless oEmbed endpoint (cached in `data.json`; only new videos are looked up). It sends each page's `ETag`
   back, so unchanged pages answer `304` and aren't downloaded again (a no-change run
   takes ~4 s; a full crawl of all 157 pages ~12 s).
2. **GitHub Actions** runs that script every 6 hours (and on demand) and commits the
   result. **GitHub Pages** serves the files publicly with CORS enabled.
3. **`search.js`** renders the search box. It downloads `index.json` only when someone
   focuses the box, searches in the browser (no server), and links each result to the
   TDPlay page it lives on, plus YouTube / Apple Music / Spotify / artist site.

## Files

| File | What it is |
|---|---|
| `build_index.py` | The indexer. Python 3, standard library only. |
| `search.js` | The search widget (all CSS + JS, no dependencies). |
| `index.html` | Standalone search page – becomes `https://mircix.github.io/tdplay-search/`. |
| `embed.html` | The 2-line snippet to paste into a Hostinger **Embed code** element. |
| `jump.html` | Optional site-wide snippet: centres + highlights the exact video a result points to. |
| `.github/workflows/build-index.yml` | The schedule. |
| `wix_import.py` + `wix_rects.json` + `wix_tracks.json` | One-off importer for the 2020–2023 Wix sites → `wix.json`. |
| `index.json` / `links.json` / `data.json` / `status.json` | Generated – don't edit by hand. |

## Set-up on GitHub (one time, all in the browser)

1. Sign in to GitHub and create a **new public repository** called `tdplay-search`
   (no README, no .gitignore – leave it empty).
2. Upload the contents of this folder (**Add file → Upload files**, drag everything in,
   including the `.github` folder) and commit.
   *Or, from a terminal in this folder:*
   ```bash
   git init -b main && git add -A && git commit -m "TDPlay search" && git remote add origin https://github.com/mircix/tdplay-search.git && git push -u origin main
   ```
3. **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*,
   Branch = `main` / `/ (root)` → Save. After a minute the page is live at
   `https://mircix.github.io/tdplay-search/`.
4. **Actions** tab → *Rebuild search index* → **Run workflow** once to confirm it runs
   green. From then on it runs itself every 6 hours.

## Put it on tdplay.site

**Option A – a search box on a page (recommended).** In the Hostinger builder add an
**Embed code** element where you want the search, paste the contents of `embed.html`
and make the element tall enough for results
(≈ 600 px+; results scroll inside it if the builder fixes the height). Publish.

**Option B – a "Search" link in the navigation** pointing at
`https://mircix.github.io/tdplay-search/`. Zero risk to the existing pages.

Both can coexist. Searches are shareable: `…/tdplay-search/?q=red%20velvet`.

**Jumping to the exact video.** Every result links to the *row* the video sits in
(`…/tdplay-august26-pg1?v=wP33kEY1iYU#zCMoGn`), which works in every browser with no
site changes. To make it pixel-exact – the page scrolls the video to the centre and flashes
a red frame around it – paste [`jump.html`](jump.html) once, site-wide:
**Website settings → Integrations → Custom code → Body** (end of body) → save → publish.

## The 2020–2023 Wix archive

The old sites (`mrxsp08.wixsite.com/tdplay23`, `/tdplay22`, `/tdplay21` and the
2020 pages under `/tdplay22`) are in the search too, from `wix.json`, which
`build_index.py` merges on every run. They are archives, so `wix.json` is built once:

- `wix_import.py` follows the links from the four year hubs, reads each page's
  component JSON (video URLs, captions, initials, icon links) and pairs them up using
  element positions from `wix_rects.json` – captured once in a browser because Wix lays
  pages out at runtime (see the script header for the snippet).
- The 2020 pages (and a few from early 2021) used a third-party POWR video widget that
  no longer loads, so those slots have no playable video. Their song is recovered from the
  slot's Spotify link (artist, title, artwork → `wix_tracks.json`) so they still show up in
  search, with the album art as the thumbnail and the Apple Music / Spotify links intact.
- Re-run `python3 wix_import.py` only if the Wix sites change (Wix rate-limits: expect a
  few "429" retries; it resumes from the caches).

## Day to day

- **New pages** appear in search within 6 hours of publishing, automatically.
  Want it sooner? Actions → *Rebuild search index* → **Run workflow**.
- **Change the schedule:** edit the `cron:` line in `.github/workflows/build-index.yml`
  (`"17 */6 * * *"` = every 6 h; `"17 * * * *"` = hourly).
- **Only published pages count** – edits sitting unpublished in the builder aren't visible
  to the crawler.
- **Hide unfinished pages:** add a pattern to the `EXCLUDE` list at the top of
  `build_index.py`; delete the line to bring them back.
- `status.json` records when the site was last checked; it changes once a day so the
  repository stays "active" (GitHub switches off schedules on repos with no commits
  for 60 days).

## Run it locally

```bash
python3 build_index.py          # incremental (only changed pages)
python3 build_index.py --full   # re-parse everything (after changing the extractor)
```

Then open `index.html` through any static server (e.g. `python3 -m http.server`), not as
a `file://` URL – browsers block `fetch()` of local files.

## Search tips (for visitors)

- artist or song: `red velvet`, `french kiss`, `renee rapp` (accents don't matter)
- initials as shown on the page: `kol`, `xcx`, `rv`
- a month: `aug 26`, `august'26`, `xmas`, `2024` – lists the pages, then every video on them
- Korean / Japanese / Chinese titles work as typed
- ↑ ↓ and Enter to pick a result, Esc to clear
