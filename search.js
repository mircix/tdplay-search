/* TDPlay site search — vanilla JS, no dependencies.
 *
 * Usage (standalone page or Hostinger "Embed code" element):
 *   <div id="tdplay-search"></div>
 *   <script src="https://<host>/tdplay-search/search.js"></script>
 *
 * The script loads index.json (and links.json lazily) from the same folder it
 * was served from. Override with data-base="https://.../tdplay-search/" on the
 * script tag if you host the JSON somewhere else.
 */
(function () {
  "use strict";

  var script = document.currentScript;
  var BASE = (script && (script.getAttribute("data-base") ||
              script.src.replace(/[^\/]*$/, ""))) || "./";
  var SITE = "https://tdplay.site";
  var THUMB = function (id) { return "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg"; };
  var ART = function (t) { return t.indexOf("sp:") === 0 ? "https://i.scdn.co/image/" + t.slice(3) : t; };   // album art for video-less slots
  var MAX_RESULTS = 80;

  // ------------------------------------------------------------ styles
  var CSS = "\
.tds{--tds-bg:#07070c;--tds-panel:#111118;--tds-line:#26262f;--tds-text:#fff;--tds-muted:#9a9aa8;\
--tds-red:#ff2b2b;--tds-cyan:#b1ffff;--tds-pink:#ff5cf0;--tds-mark:rgba(255,43,43,.28);\
font:15px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--tds-text);\
max-width:900px;margin:0 auto;box-sizing:border-box}\
.tds.tds-embedded{max-width:960px;padding:32px 30px 16px}\
@media (max-width:520px){.tds.tds-embedded{padding:26px 24px 12px}}\
.tds *{box-sizing:border-box}\
.tds-box{position:relative;display:flex;align-items:center;gap:10px;border-radius:16px;padding:6px 10px 6px 16px;transition:box-shadow .2s,border-color .2s}\
.tds-box:focus-within{border-color:rgba(255,90,90,.85);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),inset 0 0 14px rgba(255,43,43,.18),\
0 0 5px 1px rgba(255,43,43,.5),0 0 12px 2px rgba(255,43,43,.3),0 0 20px 2px rgba(255,43,43,.12),0 8px 20px rgba(0,0,0,.35)}\
.tds-box svg{flex:none;width:22px;height:22px;fill:none;stroke:var(--tds-muted);stroke-width:2.2;stroke-linecap:round}\
.tds-input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:var(--tds-text);font:inherit;font-size:19px;padding:10px 0}\
.tds-input::placeholder{color:var(--tds-muted)}\
.tds-clear{flex:none;background:transparent;border:0;color:var(--tds-muted);font-size:22px;line-height:1;cursor:pointer;padding:6px 8px;border-radius:8px}\
.tds-clear:hover{color:var(--tds-text);background:var(--tds-line)}\
.tds-status{color:var(--tds-muted);font-size:13px;padding:10px 4px 0;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}\
.tds-status b{color:var(--tds-text);font-weight:600}\
.tds-hint{color:var(--tds-muted);font-size:13px;padding:6px 4px 0}\
.tds-hint button{background:transparent;border:1px solid var(--tds-line);color:var(--tds-cyan);border-radius:999px;padding:3px 10px;margin:4px 6px 0 0;cursor:pointer;font:inherit;font-size:13px}\
.tds-hint button:hover{border-color:var(--tds-cyan)}\
.tds-results{list-style:none;margin:14px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}\
.tds-group{margin:16px 0 4px;font-family:Oswald,'Arial Narrow',Impact,sans-serif;font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:var(--tds-muted)}\
.tds-glass{background:linear-gradient(135deg,rgba(255,255,255,.12),rgba(255,255,255,.035) 40%,rgba(255,255,255,0) 70%),rgba(22,22,32,.42);\
border:1px solid rgba(255,255,255,.16);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),inset 0 -1px 0 rgba(0,0,0,.25),0 10px 28px rgba(0,0,0,.38);\
-webkit-backdrop-filter:blur(16px) saturate(150%);backdrop-filter:blur(16px) saturate(150%)}\
.tds-page{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:14px;text-decoration:none;color:inherit;transition:border-color .15s,box-shadow .15s,transform .15s}\
.tds-page:hover,.tds-page.tds-active{border-color:rgba(255,43,43,.75);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 10px 28px rgba(0,0,0,.38),0 0 22px rgba(255,43,43,.22)}\
.tds-page .tds-pn{font-family:Oswald,'Arial Narrow',Impact,sans-serif;font-size:20px;letter-spacing:.02em}\
.tds-page .tds-pn em{font-style:normal;color:var(--tds-red)}\
.tds-page .tds-pc{margin-left:auto;color:var(--tds-muted);font-size:13px;white-space:nowrap}\
.tds-item{display:grid;grid-template-columns:120px 1fr;gap:0 14px;border-radius:14px;\
overflow:hidden;text-decoration:none;color:inherit;transition:border-color .15s,transform .15s,box-shadow .15s}\
.tds-item:hover,.tds-item.tds-active{border-color:rgba(255,43,43,.75);transform:translateY(-1px);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 12px 30px rgba(0,0,0,.42),0 0 22px rgba(255,43,43,.22)}\
.tds-thumb{width:120px;aspect-ratio:16/9;background:#1a1a22 center/cover no-repeat;display:block;align-self:stretch;min-height:68px}\
.tds-body{padding:10px 12px 10px 0;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:4px}\
.tds-cap{font-size:15px;line-height:1.3;color:var(--tds-cyan);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}\
.tds-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12.5px;color:var(--tds-muted)}\
.tds-ini{font-family:Oswald,'Arial Narrow',Impact,sans-serif;font-size:15px;letter-spacing:.06em;color:var(--tds-pink);text-shadow:0 0 8px rgba(255,92,240,.6)}\
.tds-chip{background:#1c1c26;border:1px solid var(--tds-line);border-radius:999px;padding:2px 9px;white-space:nowrap}\
.tds-chip em{font-style:normal;color:var(--tds-red)}\
.tds-feat{color:#ffd166;border-color:rgba(255,209,102,.4)}\
.tds-links{display:flex;gap:6px;margin-left:auto}\
.tds-links a{position:relative;display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:10px;text-decoration:none;transition:transform .15s}\
.tds-links a:hover{transform:translateY(-1px) scale(1.06)}\
.tds-links svg{width:32px;height:32px;opacity:.82;transition:opacity .15s,filter .15s;\
filter:drop-shadow(0 -1px 0 rgba(255,255,255,.55)) drop-shadow(0 1px 0 rgba(0,0,0,.45)) drop-shadow(0 4px 8px rgba(0,0,0,.5))}\
.tds-links a:hover svg{opacity:1;filter:drop-shadow(0 -1px 0 rgba(255,255,255,.7)) drop-shadow(0 1px 0 rgba(0,0,0,.45)) drop-shadow(0 0 10px var(--tds-glow,rgba(255,255,255,.4)))}\
.tds-links .tds-l-youtube svg{fill:url(#tdsG-youtube)}.tds-links .tds-l-youtube{--tds-glow:rgba(255,40,40,.7)}\
.tds-links .tds-l-apple svg{fill:url(#tdsG-apple)}.tds-links .tds-l-apple{--tds-glow:rgba(250,60,90,.7)}\
.tds-links .tds-l-spotify svg{fill:url(#tdsG-spotify)}.tds-links .tds-l-spotify{--tds-glow:rgba(30,215,96,.7)}\
.tds-links .tds-l-site svg{fill:url(#tdsG-site)}.tds-links .tds-l-site{--tds-glow:rgba(64,224,208,.7)}\
.tds mark{background:var(--tds-mark);color:inherit;border-radius:3px;padding:0 1px}\
.tds-empty{padding:28px 12px;text-align:center;color:var(--tds-muted)}\
.tds-empty b{color:var(--tds-text)}\
.tds-more{margin-top:10px;width:100%;background:transparent;border:1px dashed var(--tds-line);color:var(--tds-muted);border-radius:12px;padding:12px;cursor:pointer;font:inherit}\
.tds-more:hover{color:var(--tds-text);border-color:var(--tds-muted)}\
@media (max-width:520px){.tds-item{grid-template-columns:96px 1fr}.tds-thumb{width:96px}.tds-input{font-size:17px}.tds-links{margin-left:0}.tds-links a{width:38px;height:38px}.tds-links svg{width:26px;height:26px}}\
";

  var ICON_SEARCH = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg>';
  var ICONS = {
    tdplay: '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM8 8l8 4-8 4z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .6 12a31 31 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.3-1.6.4-3.2.4-4.8s-.1-3.2-.4-4.8zM9.8 15.1V8.9L15.7 12z"/></svg>',
    spotify: '<svg viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>',
    apple: '<svg viewBox="0 0 24 24"><rect x="1" y="1" width="22" height="22" rx="5.5" fill="url(#tdsG-appleTile)"/><rect x="1" y="1" width="22" height="22" rx="5.5" fill="url(#tdsG-gloss)"/><rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="0.8"/><g fill="#fff"><polygon points="9.7,7.4 18.4,5.4 18.4,8.2 9.7,10.2"/><rect x="9.7" y="7.4" width="1.3" height="9.4"/><rect x="17.1" y="5.4" width="1.3" height="9.4"/><ellipse cx="8.4" cy="16.9" rx="2.5" ry="1.8" transform="rotate(-20 8.4 16.9)"/><ellipse cx="15.8" cy="14.9" rx="2.5" ry="1.8" transform="rotate(-20 15.8 14.9)"/></g></svg>',
    site: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 9h-2.9a15.6 15.6 0 0 0-1.4-5.4A8 8 0 0 1 18.9 11zM12 4c.9 1.1 1.8 3.4 2 7h-4c.2-3.6 1.1-5.9 2-7zM5.1 13h2.9c.2 2.1.7 3.9 1.4 5.4A8 8 0 0 1 5.1 13zm2.9-2H5.1a8 8 0 0 1 4.3-5.4C8.7 7.1 8.2 8.9 8 11zm4 9c-.9-1.1-1.8-3.4-2-7h4c-.2 3.6-1.1 5.9-2 7zm2.6-.6c.7-1.5 1.2-3.3 1.4-5.4h2.9a8 8 0 0 1-4.3 5.4z"/></svg>'
  };

  // ------------------------------------------------------------ helpers
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "html") el.innerHTML = attrs[k];
      else if (k === "text") el.textContent = attrs[k];
      else el.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) { if (c) el.appendChild(c); });
    return el;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Letters that accent-stripping can't fold: "LØLØ" -> "lolo", "MØ" -> "mo", "nævis" -> "naevis".
  var TRANSLIT = { "ø": "o", "ł": "l", "đ": "d", "ð": "d", "þ": "th", "æ": "ae", "œ": "oe", "ß": "ss", "ı": "i", "ħ": "h", "ŧ": "t" };
  function stripMarks(s) {
    try { return s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (e) { return s; }
  }
  function foldChar(c) {
    c = stripMarks(c.toLowerCase());
    return TRANSLIT[c] || c;
  }
  // Fold accents/case/punctuation so "renee rapp" finds "Reneé Rapp" and "lolo" finds "LØLØ".
  function norm(s) {
    s = stripMarks(String(s || "").toLowerCase());
    s = s.replace(/[øłđðþæœßıħŧ]/g, function (c) { return TRANSLIT[c] || c; });
    return s.replace(/[\u2018\u2019\u02bc]/g, "'").replace(/[^\p{L}\p{N}'&+#]+/gu, " ").replace(/\s+/g, " ").trim();
  }
  // Same folding, one output character per input character, so match positions map back onto the original text.
  function foldKeepLength(text) {
    var out = "";
    for (var i = 0; i < text.length; i++) { var f = foldChar(text[i]); out += f ? f[0] : text[i].toLowerCase(); }
    return out;
  }
  function tokens(q) { return norm(q).split(" ").filter(Boolean); }
  function monthAliases(monthLabel) {
    // "August'26" -> ["august'26","august 26","aug 26","aug'26","2026 august",...]
    var m = /^([a-z]+)'(\d\d)$/i.exec(monthLabel || "");
    if (!m) return [norm(monthLabel)];
    var name = m[1].toLowerCase(), yy = m[2], yyyy = "20" + yy, ab = name.slice(0, 3);
    return [name + " " + yy, ab + " " + yy, name + " " + yyyy, ab + " " + yyyy, name + "'" + yy, ab + "'" + yy, name, yyyy];
  }
  function splitArtist(caption) {
    var seps = [" - ", " – ", " — ", " | "];
    for (var i = 0; i < seps.length; i++) {
      var p = caption.indexOf(seps[i]);
      if (p > 0 && p <= 45) return caption.slice(0, p).trim();
    }
    return "";
  }
  function highlight(text, toks) {
    // Highlight token matches on the folded string, mapped back onto the original.
    if (!toks.length) return esc(text);
    var lower = foldKeepLength(String(text));
    var ranges = [];
    toks.forEach(function (t) {
      var raw = t, from = 0, idx;
      while (raw.length >= 2 && (idx = lower.indexOf(raw, from)) !== -1) {
        ranges.push([idx, idx + raw.length]); from = idx + raw.length;
      }
    });
    if (!ranges.length) return esc(text);
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    var out = "", pos = 0;
    ranges.forEach(function (r) {
      if (r[0] < pos) return;
      out += esc(text.slice(pos, r[0])) + "<mark>" + esc(text.slice(r[0], r[1])) + "</mark>";
      pos = r[1];
    });
    return out + esc(text.slice(pos));
  }

  // ------------------------------------------------------------ data
  var index = null, links = null, loading = null, docs = [], pageDocs = [];

  function loadIndex() {
    if (loading) return loading;
    loading = fetch(BASE + "index.json", { cache: "default" }).then(function (r) {
      if (!r.ok) throw new Error("index.json " + r.status);
      return r.json();
    }).then(function (data) {
      index = data;
      build();
      // Links are only needed for the little icons on each result; load after.
      fetch(BASE + "links.json").then(function (r) { return r.ok ? r.json() : null; })
        .then(function (l) { links = l && l.links; if (state.query) render(); }).catch(function () { });
      return data;
    });
    return loading;
  }

  function build() {
    docs = []; pageDocs = [];
    index.pages.forEach(function (p) {
      var pageText = norm(p.name) + " " + monthAliases(p.month).join(" ") +
        (p.page ? " pg" + p.page + " pg " + p.page + " page " + p.page + " p" + p.page : "");
      pageDocs.push({ page: p, text: pageText, n: norm(p.name) });
      p.items.forEach(function (it, i) {
        if (!it.yt && !it.thumb) return;
        var artist = splitArtist(it.caption || "");
        docs.push({
          page: p, it: it, i: i, ord: docs.length,
          cap: norm(it.caption), ini: norm(it.initials), art: norm(artist),
          alt: norm(it.alt || ""),          // featured videos: channel name, artwork filename, section anchor
          text: pageText
        });
      });
    });
  }

  function has(hay, t) {
    // digit-only tokens ("26", "2024") must match a whole word; short tokens ("aug", "rv")
    // must start a word (so "aug" doesn't hit "daughter"); longer ones may be substrings
    if (/^\d+$/.test(t)) return (" " + hay + " ").indexOf(" " + t + " ") !== -1;
    if (t.length <= 3) return (" " + hay).indexOf(" " + t) !== -1;
    return hay.indexOf(t) !== -1;
  }

  function score(d, toks, qn) {
    var s = 0;
    for (var k = 0; k < toks.length; k++) {
      var t = toks[k], hit = 0;
      if (d.ini && d.ini === t) hit = 60;                         // exact initials ("kol", "xcx")
      else if (has(d.cap, t)) {
        hit = 20;
        if (d.art && has(d.art, t)) hit += 15;                    // in the artist part of "Artist - Title"
        if (d.cap.indexOf(t) === 0 || d.cap.indexOf(" " + t) !== -1) hit += 6;   // word start
      }
      else if (d.alt && has(d.alt, t)) hit = 16;                   // featured-video hints
      else if (has(d.text, t)) hit = 4;                            // matches the page/month only
      if (!hit) return 0;
      s += hit;
    }
    if (qn.length > 2 && d.cap.indexOf(qn) !== -1) s += 25;       // whole phrase present
    if (qn.length > 2 && d.cap.indexOf(qn) === 0) s += 30;        // caption starts with the query
    if (qn && d.art === qn) s += 40;                              // exact artist
    if (d.it.featured) s += 3;                                    // the page's headline video edges ahead on ties
    if (d.ini && d.ini === qn) s += 40;
    return s;
  }

  function search(q) {
    var toks = tokens(q), qn = norm(q);
    if (!toks.length) return { items: [], pages: [] };
    var res = [];
    for (var i = 0; i < docs.length; i++) {
      var s = score(docs[i], toks, qn);
      if (s > 0) res.push({ d: docs[i], s: s });
    }
    var strict = res.filter(function (r) { return r.s > 4 * toks.length; }); // drop page-only hits when the query had real matches
    var pageOnly = strict.length === 0 && res.length > 0;
    if (strict.length) res = strict;
    res.sort(function (a, b) { return b.s - a.s || a.d.ord - b.d.ord; });
    var pages = pageDocs.filter(function (pd) {
      return toks.every(function (t) { return has(pd.text, t); });
    }).map(function (pd) { return pd.page; });
    return { items: res, pages: pages, pageOnly: pageOnly };
  }

  // ------------------------------------------------------------ ui
  var root = document.getElementById("tdplay-search");
  if (!root) { root = h("div", { id: "tdplay-search" }); (script && script.parentNode || document.body).insertBefore(root, script || null); }
  root.classList.add("tds");
  // Inside an embed iframe (Hostinger) the frame clips at the widget's edges, so leave room for the glows.
  if (window.top !== window.self) root.classList.add("tds-embedded");
  var styleTag = h("style", { text: CSS }); document.head.appendChild(styleTag);
  var defs = document.createElement("div");
  defs.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  defs.innerHTML = '<svg width="0" height="0" aria-hidden="true"><defs>' +
    '<linearGradient id="tdsG-youtube" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8080"/><stop offset=".45" stop-color="#ff1a1a"/><stop offset="1" stop-color="#c40000"/></linearGradient>' +
    '<linearGradient id="tdsG-apple" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb3c2"/><stop offset=".45" stop-color="#fc4b6a"/><stop offset="1" stop-color="#e0142f"/></linearGradient>' +
    '<linearGradient id="tdsG-spotify" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ff0b3"/><stop offset=".45" stop-color="#1ed760"/><stop offset="1" stop-color="#149a45"/></linearGradient>' +
    '<linearGradient id="tdsG-appleTile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7f98" stop-opacity=".88"/><stop offset="1" stop-color="#f21e38" stop-opacity=".88"/></linearGradient>' +
    '<linearGradient id="tdsG-gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".48" stop-color="#fff" stop-opacity=".08"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="tdsG-site" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8fff7"/><stop offset=".45" stop-color="#40e0d0"/><stop offset="1" stop-color="#1fa89b"/></linearGradient>' +
    '</defs></svg>';
  root.appendChild(defs);
  if (!document.querySelector('link[href*="family=Oswald"]')) {
    document.head.appendChild(h("link", { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&display=swap" }));
  }

  var input = h("input", { "class": "tds-input", type: "text", inputmode: "search", enterkeyhint: "search", placeholder: "Search artists, songs, months…",
                            "aria-label": "Search TDPlay", autocomplete: "off", spellcheck: "false" });
  var clear = h("button", { "class": "tds-clear", type: "button", "aria-label": "Clear", html: "&times;" });
  clear.style.visibility = "hidden";
  var box = h("div", { "class": "tds-box tds-glass" }, [h("span", { html: ICON_SEARCH }), input, clear]);
  var status = h("div", { "class": "tds-status" });
  var hint = h("div", { "class": "tds-hint" });
  var list = h("ol", { "class": "tds-results", role: "listbox" });
  root.appendChild(box); root.appendChild(status); root.appendChild(hint); root.appendChild(list);

  var state = { query: "", shown: MAX_RESULTS, active: -1, result: null, allPages: false };
  var PAGES_COLLAPSED = 6;
  var openTarget = (window.top !== window.self) ? "_top" : "_self";  // works inline or inside an iframe embed

  // Result links land on the row (<section id>) natively in every browser; ?v=<YouTube id>
  // lets the optional site-wide jump script (jump.html) centre and highlight the exact card.
  function pageUrl(p, it) {
    var u = p.url || (SITE + "/" + (p.slug === "home" ? "" : p.slug));   // p.url = archive pages on other hosts
    if (it && it.yt && !p.url) u += "?v=" + it.yt;                        // ?v= only matters for the jump script on tdplay.site
    if (it && it.anchor) u += "#" + it.anchor;
    return u;
  }

  function setStatus(html) { status.innerHTML = html; }

  function idleHint() {
    if (!index) { hint.innerHTML = ""; return; }
    var latest = index.pages.filter(function (p) { return p.page === 1; }).slice(0, 4);
    hint.innerHTML = "Try: ";
    latest.forEach(function (p) {
      var b = h("button", { type: "button", text: p.month });
      b.onclick = function () { input.value = p.month; onInput(); input.focus(); };
      hint.appendChild(b);
    });
  }

  function render() {
    var q = state.query;
    list.innerHTML = "";
    state.active = -1;
    if (!q) {
      setStatus(index ? "<span><b>" + index.itemCount.toLocaleString() + "</b> videos across <b>" + index.pageCount + "</b> pages</span><span>updated " + esc((index.generated || "").slice(0, 10)) + "</span>" : "");
      idleHint(); return;
    }
    hint.innerHTML = "";
    if (!index) { setStatus("Loading…"); return; }
    var toks = tokens(q), r = state.result = search(q);
    var n = r.items.length;
    setStatus("<span><b>" + n.toLocaleString() + "</b> " + (n === 1 ? "video" : "videos") + (r.pages.length ? " · <b>" + r.pages.length + "</b> " + (r.pages.length === 1 ? "page" : "pages") : "") + "</span>" +
      (r.pageOnly ? "<span>matched by page name only</span>" : ""));

    if (r.pages.length) {
      list.appendChild(h("li", { "class": "tds-group", text: "Pages" }));
      var shownPages = state.allPages ? r.pages : r.pages.slice(0, PAGES_COLLAPSED);
      shownPages.forEach(function (p) {
        var name = p.name.replace(/^TDPlay\s*-?\s*/, "");
        var a = h("a", { "class": "tds-page tds-glass", href: pageUrl(p), target: openTarget, role: "option" }, [
          h("span", { "class": "tds-pn", html: "TDPlay <em>" + highlight(name, toks) + "</em>" }),
          h("span", { "class": "tds-pc", text: p.items.length ? p.items.length + " videos" : "" })
        ]);
        list.appendChild(h("li", null, [a]));
      });
      if (r.pages.length > PAGES_COLLAPSED) {
        var pt = h("button", { "class": "tds-more", type: "button",
          text: state.allPages ? "Show fewer pages" : "Show all " + r.pages.length + " pages" });
        pt.onclick = function () { state.allPages = !state.allPages; render(); };
        list.appendChild(h("li", null, [pt]));
      }
      if (n) list.appendChild(h("li", { "class": "tds-group", text: "Videos" }));
    }
    if (!n && !r.pages.length) {
      list.appendChild(h("li", { "class": "tds-empty", html: "Nothing found for <b>" + esc(q) + "</b>.<br>Try an artist, a song title, initials, or a month like <b>Aug 26</b>." }));
      return;
    }
    r.items.slice(0, state.shown).forEach(function (row) {
      var p = row.d.page, it = row.d.it;
      var l = (links && links[p.slug + "/" + (it.yt || it.anchor || "")]) || {};
      var linkEls = [];
      function ext(kind, href, title) {
        var a = h("a", { "class": "tds-l-" + kind, href: href, target: "_blank", rel: "noopener", title: title, html: ICONS[kind] });
        a.addEventListener("click", function (e) { e.stopPropagation(); });
        linkEls.push(a);
      }
      if (it.yt) ext("youtube", "https://www.youtube.com/watch?v=" + it.yt, "Watch on YouTube");
      if (l.apple) ext("apple", l.apple, "Apple Music");
      if (l.spotify) ext("spotify", l.spotify, "Spotify");
      if (l.youtube) ext("youtube", l.youtube, "Artist on YouTube");
      if (l.site) ext("site", l.site, "Artist website");
      var a = h("a", { "class": "tds-item tds-glass", href: pageUrl(p, it), target: openTarget, role: "option", title: "Open " + p.name }, [
        h("span", { "class": "tds-thumb", style: "background-image:url(" + (it.yt ? THUMB(it.yt) : ART(it.thumb)) + ")" }),
        h("span", { "class": "tds-body" }, [
          h("span", { "class": "tds-cap", html: highlight(it.caption || "(untitled)", toks) }),
          h("span", { "class": "tds-meta" }, [
            it.initials ? h("span", { "class": "tds-ini", html: highlight(it.initials, toks) }) : null,
            h("span", { "class": "tds-chip", html: "<em>" + esc(p.month) + "</em>" + (p.page ? " · PG." + p.page : "") }),
            it.featured ? h("span", { "class": "tds-chip tds-feat", text: "★ Featured" }) : null,
            h("span", { "class": "tds-links" }, linkEls)
          ])
        ])
      ]);
      list.appendChild(h("li", null, [a]));
    });
    if (n > state.shown) {
      var more = h("button", { "class": "tds-more", type: "button", text: "Show " + Math.min(MAX_RESULTS, n - state.shown) + " more (" + (n - state.shown) + " left)" });
      more.onclick = function () { state.shown += MAX_RESULTS; render(); };
      list.appendChild(h("li", null, [more]));
    }
  }

  var timer = null;
  function onInput() {
    state.query = input.value.trim();
    state.shown = MAX_RESULTS;
    state.allPages = false;
    clear.style.visibility = state.query ? "visible" : "hidden";
    try { history.replaceState(null, "", state.query ? "?q=" + encodeURIComponent(state.query) : location.pathname); } catch (e) { }
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (!index) { loadIndex().then(render).catch(function (e) { setStatus("Couldn’t load the search index (" + esc(e.message) + ")."); }); render(); }
      else render();
    }, 60);
  }
  input.addEventListener("input", onInput);
  input.addEventListener("focus", function () { loadIndex().then(function () { if (!state.query) render(); }).catch(function () { }); });
  clear.addEventListener("click", function () { input.value = ""; onInput(); input.focus(); });
  input.addEventListener("keydown", function (e) {
    var opts = list.querySelectorAll('[role="option"]');
    if (!opts.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      state.active = (state.active + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length;
      opts.forEach(function (o, i) { o.classList.toggle("tds-active", i === state.active); });
      opts[state.active].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && state.active >= 0) {
      e.preventDefault(); opts[state.active].click();
    } else if (e.key === "Escape") { input.value = ""; onInput(); }
  });

  // Deep link: ?q=... (also works when embedded, reading the parent URL if reachable)
  var initial = "";
  try { initial = new URLSearchParams(location.search).get("q") || ""; } catch (e) { }
  if (!initial) { try { initial = new URLSearchParams(window.top.location.search).get("q") || ""; } catch (e) { } }
  if (initial) { input.value = initial; onInput(); }
  else if (script && script.getAttribute("data-preload") !== "false") {
    // Warm the index in the background on the standalone page (or when the embed says
    // data-preload="true", e.g. a dedicated search page); other embeds wait for focus.
    var pre = script.getAttribute("data-preload");
    if (pre === "true" || !(window.top !== window.self)) setTimeout(function () { loadIndex().then(render).catch(function () { }); }, 300);
  }
  render();
})();
