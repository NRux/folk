"use strict";
// Map page data: place coordinates (geocoded once via OpenStreetMap/Nominatim,
// 2026-10-09) and the country -> region roll-up used by the map filters.
// Coordinates are keyed by the exact articles.place_label values in the store.

const PLACE_COORDS = {
  "New Orleans, United States": { lat: 29.9575, lon: -90.0629 },
  "Detroit & Belleville, United States": { lat: 42.3316, lon: -83.0466 },
  "Lisbon, Portugal": { lat: 38.7078, lon: -9.1366 },
  "Teotitlán del Valle, Mexico": { lat: 17.0499, lon: -96.5028 },
  "Tokushima Prefecture, Japan": { lat: 33.9196, lon: 134.251 },
  "Kumasi, Ghana": { lat: 6.6986, lon: -1.6233 },
  "Bonwire, Ghana": { lat: 6.7946, lon: -1.4669 },
  "Dakar, Senegal": { lat: 14.6934, lon: -17.4479 },
  "Essaouira, Morocco": { lat: 31.5118, lon: -9.7621 },
  "Seoul, South Korea": { lat: 37.5667, lon: 126.9783 },
  "Tarragona, Spain": { lat: 41.1172, lon: 1.2546 },
  "Xochimilco, Mexico City, Mexico": { lat: 19.2634, lon: -99.1047 },
  "Lake Sebu, Philippines": { lat: 6.226, lon: 124.7123 },
  "Havana, Cuba": { lat: 23.1353, lon: -82.359 },
  "Dushanbe, Tajikistan": { lat: 38.5767, lon: 68.7854 },
  "Aotearoa New Zealand": { lat: -38.6866, lon: 176.0695 },
};

const COUNTRY_REGION = {
  "United States": "north-america",
  Canada: "north-america",
  Mexico: "latin-america",
  Cuba: "latin-america",
  "Dominican Republic": "latin-america",
  Portugal: "europe",
  Spain: "europe",
  Japan: "asia",
  "South Korea": "asia",
  Philippines: "asia",
  Tajikistan: "asia",
  Ghana: "africa",
  Senegal: "africa",
  Morocco: "africa",
  "New Zealand": "oceania",
};

const REGION_LABELS = {
  africa: "Africa",
  asia: "Asia",
  europe: "Europe",
  "north-america": "North America",
  "latin-america": "Latin America & Caribbean",
  oceania: "Oceania",
};

function coordsFor(placeLabel) {
  return PLACE_COORDS[placeLabel] || null;
}

function regionForCountry(country) {
  return COUNTRY_REGION[country] || null;
}

// Equirectangular 360x180 asset: one unit = one degree.
// Marker position as percentages of the map box.
function pinPosition(lat, lon) {
  return { x: ((lon + 180) / 360) * 100, y: ((90 - lat) / 180) * 100 };
}

module.exports = { PLACE_COORDS, COUNTRY_REGION, REGION_LABELS, coordsFor, regionForCountry, pinPosition };
