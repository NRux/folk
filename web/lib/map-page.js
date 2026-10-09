"use strict";
// Map page: every published story pinned to its place, filterable by region and
// thread; the list below the map stays in step with the filters. Zero dependencies:
// equirectangular SVG base (one degree = one unit) + absolutely positioned pins.

const { esc, slugify } = require("./render");
const { coordsFor, regionForCountry, REGION_LABELS, pinPosition } = require("./mapdata");

// Build the map page model from published articles.
function mapArticles(page) {
  return page.allPublished
    .map((a) => {
      const coords = coordsFor(a.place_label);
      const region = regionForCountry(a.country);
      const topicLabel = (a.category || "").trim();
      return {
        slug: a.slug,
        title: a.title,
        place: a.place_label || "",
        country: a.country || "",
        region,
        topicKey: topicLabel ? slugify(topicLabel) : null,
        topicLabel,
        persona: a.persona_id && page.personas.get(a.persona_id) ? page.personas.get(a.persona_id).name : null,
        readingMinutes: a.reading_minutes || null,
        coords,
      };
    })
    .filter((a) => a.coords && a.region); // unmappable articles stay off the map page
}

function renderMapPage(page) {
  const arts = mapArticles(page);
  const regions = [...new Set(arts.map((a) => a.region))];
  const topics = [...new Map(arts.map((a) => [a.topicKey, a.topicLabel]))];

  const regionChips = regions
    .sort()
    .map((r) => `<button type="button" class="chip" data-filter="region" data-value="${esc(r)}" aria-pressed="false">${esc(REGION_LABELS[r] || r)}</button>`)
    .join("");
  const topicChips = topics
    .map(([key, label]) => `<button type="button" class="chip" data-filter="topic" data-value="${esc(key)}" aria-pressed="false">${esc(label)}</button>`)
    .join("");

  const pins = arts
    .map((a) => {
      const { x, y } = pinPosition(a.coords.lat, a.coords.lon);
      return `<a class="pin" href="/${esc(a.slug)}" data-region="${esc(a.region)}" data-topic="${esc(a.topicKey || "")}" style="left:${x}%;top:${y}%" aria-label="${esc(a.title)} — ${esc(a.place)}"><span class="pin-dot"></span><span class="pin-label">${esc(a.place)}</span></a>`;
    })
    .join("");

  const cards = arts
    .map(
      (a) => `<article class="map-card" data-region="${esc(a.region)}" data-topic="${esc(a.topicKey || "")}" data-slug="${esc(a.slug)}">
      <p class="eyebrow">${esc(a.place)}</p>
      <h2><a href="/${esc(a.slug)}">${esc(a.title)}</a></h2>
      <p class="map-card-meta">${esc(a.persona || "Folkly editorial")}${a.readingMinutes ? ` &middot; ${a.readingMinutes} min read` : ""}</p>
    </article>`
    )
    .join("");

  return `<main id="main" class="shell">
  <div class="intro"><h1>Where the journal goes.</h1><p>Every story, pinned to the place it comes from. Filter by region or thread; the map and the list below stay in step.</p></div>
  <section class="map-page">
    <div class="map-filters">
      <div class="filter-group" role="group" aria-label="Filter by region"><span class="filter-name">Region</span>${regionChips}</div>
      <div class="filter-group" role="group" aria-label="Filter by thread"><span class="filter-name">Thread</span>${topicChips}</div>
      <p class="map-count" id="map-count" role="status" aria-live="polite"></p>
    </div>
    <div class="map-frame" id="map-frame">
      <img src="/assets/world-equirectangular.svg" alt="World map with a pin for every Folkly story" width="1440" height="720" loading="lazy">
      ${pins}
    </div>
    <p class="map-note">Base map: Natural Earth data, equirectangular projection (public domain via Wikimedia Commons).</p>
    <section class="map-list" id="map-list" aria-label="Stories in the current filter">
      <div class="section-head"><h2>Stories in view</h2><span id="map-list-sub"></span></div>
      <div class="map-grid" id="map-grid">${cards}</div>
    </section>
  </section>
</main>
<script>
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
    } catch (e) { /* no hash support */ }
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
    var okTopic = !state.topic.length || state.topic.indexOf(el.dataset.topic) >= 0;
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
    var places = new Set(pins.filter(function (p) { return !p.classList.contains("is-hidden"); }).map(function (p) { return p.getAttribute("aria-label"); })).size;
    var label = visible === 1 ? "story" : "stories";
    countEl.textContent = visible + " " + label + " \u00b7 " + (visible ? places : 0) + (places === 1 ? " place" : " places");
    subEl.textContent = visible ? "Filtered to the pins above." : "Nothing in the journal matches yet.";
  }
  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      var f = c.dataset.filter, v = c.dataset.value, at = state[f].indexOf(v);
      if (at >= 0) state[f].splice(at, 1); else state[f].push(v);
      toHash(); syncChips(); apply();
    });
  });
  pins.forEach(function (p) {
    p.addEventListener("mouseenter", function () { var c = document.querySelector('.map-card[data-slug="' + p.href.split("/").pop() + '"]'); if (c) c.classList.add("is-active"); });
    p.addEventListener("mouseleave", function () { var c = document.querySelector('.map-card[data-slug="' + p.href.split("/").pop() + '"]'); if (c) c.classList.remove("is-active"); });
  });
  cards.forEach(function (c) {
    c.addEventListener("mouseenter", function () { var p = document.querySelector('.pin[href="/' + c.dataset.slug + '"]'); if (p) p.classList.add("is-active"); });
    c.addEventListener("mouseleave", function () { var p = document.querySelector('.pin[href="/' + c.dataset.slug + '"]'); if (p) p.classList.remove("is-active"); });
  });
  window.addEventListener("hashchange", function () { fromHash(); syncChips(); apply(); });
  fromHash(); syncChips(); apply();
})();
</script>`;
}

module.exports = { renderMapPage, mapArticles };
