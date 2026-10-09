import { escapeHtml, topicLabel } from './public-articles.mjs';
import { REGIONS, validateGeography } from './geography.mjs';
import mapdata from '../web/lib/mapdata.js';

// Public story map for the static Vercel reader: every published story pinned to
// its place on the equirectangular world SVG, filterable by region and tag, with
// the list below the map staying in step. Same data + base asset as the Node
// server's /map; this variant reuses the deployed page shell and the site's
// shared style.css (map styles are committed there).
export function mapPage(template, items, origin) {
  const arts = items
    .map((item) => {
      const coords = mapdata.PLACE_COORDS[item.placeName];
      if (!coords) return null;
      validateGeography(item);
      return { ...item, coords, region: item.regionSlug, topics: item.topics || [] };
    })
    .filter(Boolean);
  if (arts.length !== items.length) {
    throw new Error('Every published story must have geocoded map coordinates');
  }
  const regions = [...new Set(arts.map((a) => a.region))].sort();
  const topics = [...new Set(arts.flatMap((a) => a.topics))].sort((a, b) => topicLabel(a).localeCompare(topicLabel(b)));
  const e = escapeHtml;
  const regionChips = regions
    .map((r) => `<button type="button" class="chip" data-filter="region" data-value="${e(r)}" aria-pressed="false">${e(REGIONS[r] || r)}</button>`)
    .join('');
  const topicChips = topics
    .map((t) => `<button type="button" class="chip" data-filter="topic" data-value="${e(t)}" aria-pressed="false">${e(topicLabel(t))}</button>`)
    .join('');
  const pins = arts
    .map((a) => {
      const { x, y } = mapdata.pinPosition(a.coords.lat, a.coords.lon);
      return `<a class="pin" href="/${e(a.slug)}" data-slug="${e(a.slug)}" data-region="${e(a.region)}" data-topics="${e(a.topics.join(' '))}" style="left:${x}%;top:${y}%" aria-label="${e(a.title)} — ${e(a.placeName)}"><span class="pin-dot"></span><span class="pin-label">${e(a.placeName)}</span></a>`;
    })
    .join('');
  const cards = arts
    .map(
      (a) => `<article class="map-card" data-region="${e(a.region)}" data-topics="${e(a.topics.join(' '))}" data-slug="${e(a.slug)}"><p class="eyebrow">${e(a.placeName)}</p><h2><a href="/${e(a.slug)}">${e(a.title)}</a></h2><p class="map-card-meta">${e(a.authorSlug ? a.authorSlug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') : 'Folkly editorial')} &middot; ${e(a.publishedAt)}</p></article>`
    )
    .join('');
  const content = `<div class="intro"><h1>Where the journal goes.</h1><p>Every story, pinned to the place it comes from. Filter by region or thread; the map and the list below stay in step.</p></div>
<section class="map-page"><div class="map-filters"><div class="filter-group" role="group" aria-label="Filter by region"><span class="filter-name">Region</span>${regionChips}</div><div class="filter-group" role="group" aria-label="Filter by thread"><span class="filter-name">Thread</span>${topicChips}</div><p class="map-count" id="map-count" role="status" aria-live="polite"></p></div>
<div class="map-frame" id="map-frame"><img src="/assets/world-equirectangular.svg" alt="World map with a pin for every Folkly story" width="1440" height="720" loading="lazy">${pins}</div>
<p class="map-note">Base map: Natural Earth data, equirectangular projection (public domain via Wikimedia Commons).</p>
<section class="map-list" id="map-list" aria-label="Stories in the current filter"><div class="section-head"><h2>Stories in view</h2><span id="map-list-sub"></span></div><div class="map-grid" id="map-grid">${cards}</div></section></section>`;
  const script = `<script>
(function () {
  var chips = [].slice.call(document.querySelectorAll(".chip"));
  var pins = [].slice.call(document.querySelectorAll(".pin"));
  var cards = [].slice.call(document.querySelectorAll(".map-card"));
  var countEl = document.getElementById("map-count");
  var subEl = document.getElementById("map-list-sub");
  var state = { region: [], topic: [] };
  function fromHash() {
    try {
      var q = new URLSearchParams(location.hash.slice(1));
      state.region = q.getAll("region");
      state.topic = q.getAll("topic");
    } catch (err) { /* ignore */ }
  }
  function toHash() {
    var q = new URLSearchParams();
    state.region.forEach(function (v) { q.append("region", v); });
    state.topic.forEach(function (v) { q.append("topic", v); });
    var h = q.toString();
    history.replaceState(null, "", h ? "#" + h : location.pathname);
  }
  function syncChips() {
    chips.forEach(function (c) {
      c.setAttribute("aria-pressed", state[c.dataset.filter].indexOf(c.dataset.value) >= 0 ? "true" : "false");
    });
  }
  function matches(el) {
    var okRegion = !state.region.length || state.region.indexOf(el.dataset.region) >= 0;
    var elTopics = (el.dataset.topics || "").split(" ").filter(Boolean);
    var okTopic = !state.topic.length || state.topic.some(function (t) { return elTopics.indexOf(t) >= 0; });
    return okRegion && okTopic;
  }
  function apply() {
    var visible = 0;
    for (var i = 0; i < pins.length; i++) {
      var show = matches(pins[i]);
      pins[i].classList.toggle("is-hidden", !show);
      if (show) visible++;
    }
    for (var j = 0; j < cards.length; j++) cards[j].classList.toggle("is-hidden", !matches(cards[j]));
    countEl.textContent = visible + (visible === 1 ? " story" : " stories") + " in view";
    subEl.textContent = visible ? "Filtered to the pins above." : "Nothing matches yet.";
  }
  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      var f = c.dataset.filter, v = c.dataset.value, at = state[f].indexOf(v);
      if (at >= 0) state[f].splice(at, 1); else state[f].push(v);
      toHash(); syncChips(); apply();
    });
  });
  function peerOf(el, sel) { return document.querySelector(sel + '[data-slug="' + el.dataset.slug + '"]'); }
  pins.forEach(function (p) {
    p.addEventListener("mouseenter", function () { var c = peerOf(p, ".map-card"); if (c) c.classList.add("is-active"); });
    p.addEventListener("mouseleave", function () { var c = peerOf(p, ".map-card"); if (c) c.classList.remove("is-active"); });
  });
  cards.forEach(function (c) {
    c.addEventListener("mouseenter", function () { var p = peerOf(c, ".pin"); if (p) p.classList.add("is-active"); });
    c.addEventListener("mouseleave", function () { var p = peerOf(c, ".pin"); if (p) p.classList.remove("is-active"); });
  });
  window.addEventListener("hashchange", function () { fromHash(); syncChips(); apply(); });
  fromHash(); syncChips(); apply();
})();
</script>`;
  let html = template.replace(/<title>[\s\S]*?<\/title>/, `<title>Map | Folkly</title>`);
  html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${origin}/map">`);
  html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="Every Folkly story on one map, filtered by region and thread.">`);
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
  html = html.replace(/<meta property="og:[^"]*" content="[^"]*">/g, '');
  html = html.replace(/<main id="main" class="shell">[\s\S]*?<\/main>/, `<main id="main" class="shell">${content}</main>`);
  return html.replace('</body>', `${script}</body>`);
}
