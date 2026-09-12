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
  var MAX_RESULTS = 80;

  // ------------------------------------------------------------ styles
  var CSS = "\
.tds{--tds-bg:#07070c;--tds-panel:#111118;--tds-line:#26262f;--tds-text:#fff;--tds-muted:#9a9aa8;\
--tds-red:#ff2b2b;--tds-cyan:#b1ffff;--tds-pink:#ff5cf0;--tds-mark:rgba(255,43,43,.28);\
font:15px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--tds-text);\
max-width:900px;margin:0 auto;box-sizing:border-box}\
.tds *{box-sizing:border-box}\
.tds-box{position:relative;display:flex;align-items:center;gap:10px;background:var(--tds-panel);border:1px solid var(--tds-line);\
border-radius:14px;padding:6px 10px 6px 16px;box-shadow:0 0 0 0 rgba(255,43,43,0);transition:box-shadow .2s,border-color .2s}\
.tds-box:focus-within{border-color:var(--tds-red);box-shadow:0 0 0 4px rgba(255,43,43,.18)}\
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
.tds-page{display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--tds-panel);border:1px solid var(--tds-line);border-radius:12px;text-decoration:none;color:inherit}\
.tds-page:hover,.tds-page.tds-active{border-color:var(--tds-red)}\
.tds-page .tds-pn{font-family:Oswald,'Arial Narrow',Impact,sans-serif;font-size:20px;letter-spacing:.02em}\
.tds-page .tds-pn em{font-style:normal;color:var(--tds-red)}\
.tds-page .tds-pc{margin-left:auto;color:var(--tds-muted);font-size:13px;white-space:nowrap}\
.tds-item{display:grid;grid-template-columns:120px 1fr;gap:0 14px;background:var(--tds-panel);border:1px solid var(--tds-line);border-radius:12px;\
overflow:hidden;text-decoration:none;color:inherit;transition:border-color .15s,transform .15s}\
.tds-item:hover,.tds-item.tds-active{border-color:var(--tds-red);transform:translateY(-1px)}\
.tds-thumb{width:120px;aspect-ratio:16/9;background:#1a1a22 center/cover no-repeat;display:block;align-self:stretch;min-height:68px}\
.tds-body{padding:10px 12px 10px 0;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:4px}\
.tds-cap{font-size:15px;line-height:1.3;color:var(--tds-cyan);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}\
.tds-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12.5px;color:var(--tds-muted)}\
.tds-ini{font-family:Oswald,'Arial Narrow',Impact,sans-serif;font-size:15px;letter-spacing:.06em;color:var(--tds-pink);text-shadow:0 0 8px rgba(255,92,240,.6)}\
.tds-chip{background:#1c1c26;border:1px solid var(--tds-line);border-radius:999px;padding:2px 9px;white-space:nowrap}\
.tds-chip em{font-style:normal;color:var(--tds-red)}\
.tds-links{display:flex;gap:4px;margin-left:auto}\
.tds-links a{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;color:var(--tds-muted);text-decoration:none}\
.tds-links a:hover{background:#1c1c26;color:var(--tds-text)}\
.tds-links svg{width:16px;height:16px;fill:currentColor}\
.tds mark{background:var(--tds-mark);color:inherit;border-radius:3px;padding:0 1px}\
.tds-empty{padding:28px 12px;text-align:center;color:var(--tds-muted)}\
.tds-empty b{color:var(--tds-text)}\
.tds-more{margin-top:10px;width:100%;background:transparent;border:1px dashed var(--tds-line);color:var(--tds-muted);border-radius:12px;padding:12px;cursor:pointer;font:inherit}\
.tds-more:hover{color:var(--tds-text);border-color:var(--tds-muted)}\
@media (max-width:520px){.tds-item{grid-template-columns:96px 1fr}.tds-thumb{width:96px}.tds-input{font-size:17px}.tds-links{margin-left:0}}\
";

  var ICON_SEARCH = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg>';
  var ICONS = {
    tdplay: '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM8 8l8 4-8 4z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .6 12a31 31 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.3-1.6.4-3.2.4-4.8s-.1-3.2-.4-4.8zM9.8 15.1V8.9L15.7 12z"/></svg>',
    spotify: '<svg viewBox="0 0 24 24"><path d="M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21zm4.8 15.2a.7.7 0 0 1-1 .2c-2.6-1.6-5.9-2-9.8-1.1a.7.7 0 1 1-.3-1.3c4.3-1 8-.5 10.9 1.3.3.2.4.6.2.9zm1.3-2.9a.8.8 0 0 1-1.1.3c-3-1.8-7.6-2.4-11.1-1.3a.8.8 0 1 1-.5-1.6c4-1.2 9-.6 12.5 1.5.4.2.5.7.2 1.1zm.1-3a1 1 0 0 1-1.4.3C13.3 9 7.4 8.8 4.1 9.8a1 1 0 1 1-.6-1.9c3.8-1.2 10.3-.9 14.3 1.5.5.3.6.9.4 1.4z"/></svg>',
    apple: '<svg viewBox="0 0 24 24"><path d="M16.4 12.7c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.8-1.1-2.8-4.1zM14 5.3c.7-.8 1.2-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z"/></svg>',
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
  // Fold accents/case/punctuation so "renee rapp" finds "Reneé Rapp".
  function norm(s) {
    s = String(s || "").toLowerCase();
    try { s = s.normalize("NFD").replace(/[̀-ͯ]/g, ""); } catch (e) { }
    return s.replace(/[‘’ʼ]/g, "'").replace(/[^\p{L}\p{N}'&+#]+/gu, " ").replace(/\s+/g, " ").trim();
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
    var lower = String(text).toLowerCase();
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
        if (!it.yt) return;
        var artist = splitArtist(it.caption || "");
        docs.push({
          page: p, it: it, i: i, ord: docs.length,
          cap: norm(it.caption), ini: norm(it.initials), art: norm(artist),
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
      else if (has(d.text, t)) hit = 4;                            // matches the page/month only
      if (!hit) return 0;
      s += hit;
    }
    if (qn.length > 2 && d.cap.indexOf(qn) !== -1) s += 25;       // whole phrase present
    if (qn.length > 2 && d.cap.indexOf(qn) === 0) s += 30;        // caption starts with the query
    if (qn && d.art === qn) s += 40;                              // exact artist
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
  var styleTag = h("style", { text: CSS }); document.head.appendChild(styleTag);
  if (!document.querySelector('link[href*="family=Oswald"]')) {
    document.head.appendChild(h("link", { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&display=swap" }));
  }

  var input = h("input", { "class": "tds-input", type: "text", inputmode: "search", enterkeyhint: "search", placeholder: "Search artists, songs, months…",
                            "aria-label": "Search TDPlay", autocomplete: "off", spellcheck: "false" });
  var clear = h("button", { "class": "tds-clear", type: "button", "aria-label": "Clear", html: "&times;" });
  clear.style.visibility = "hidden";
  var box = h("div", { "class": "tds-box" }, [h("span", { html: ICON_SEARCH }), input, clear]);
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
    var u = SITE + "/" + (p.slug === "home" ? "" : p.slug);
    if (it && it.yt) u += "?v=" + it.yt;
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
        var a = h("a", { "class": "tds-page", href: pageUrl(p), target: openTarget, role: "option" }, [
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
      var l = (links && links[p.slug + "/" + it.yt]) || {};
      var linkEls = [];
      function ext(kind, href, title) {
        var a = h("a", { href: href, target: "_blank", rel: "noopener", title: title, html: ICONS[kind] });
        a.addEventListener("click", function (e) { e.stopPropagation(); });
        linkEls.push(a);
      }
      ext("youtube", "https://www.youtube.com/watch?v=" + it.yt, "Watch on YouTube");
      if (l.apple) ext("apple", l.apple, "Apple Music");
      if (l.spotify) ext("spotify", l.spotify, "Spotify");
      if (l.youtube) ext("youtube", l.youtube, "Artist on YouTube");
      if (l.site) ext("site", l.site, "Artist website");
      var a = h("a", { "class": "tds-item", href: pageUrl(p, it), target: openTarget, role: "option", title: "Open " + p.name }, [
        h("span", { "class": "tds-thumb", style: "background-image:url(" + THUMB(it.yt) + ")" }),
        h("span", { "class": "tds-body" }, [
          h("span", { "class": "tds-cap", html: highlight(it.caption || "(untitled)", toks) }),
          h("span", { "class": "tds-meta" }, [
            it.initials ? h("span", { "class": "tds-ini", html: highlight(it.initials, toks) }) : null,
            h("span", { "class": "tds-chip", html: "<em>" + esc(p.month) + "</em>" + (p.page ? " · PG." + p.page : "") }),
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
    // Warm the index in the background on the standalone page; the embed waits for focus.
    if (!(window.top !== window.self)) setTimeout(function () { loadIndex().then(render).catch(function () { }); }, 300);
  }
  render();
})();
