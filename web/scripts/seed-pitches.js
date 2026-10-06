"use strict";
// Seed pitch backlog for the stage-04 pipeline run (idempotent).
// One real seed pitch + two gate-demonstration fixtures (isolated from real slots).
const { openDb } = require("../lib/db");
const db = openDb(process.argv[2] || require("path").join(__dirname, "..", "folkly.db"));

const now = new Date().toISOString();
const PITCHES = [
  {
    id: "p-tokushima-aizome",
    title: "The indigo that taught a city its color",
    persona_id: "mira-sol",
    place: "Tokushima Prefecture, Japan",
    practice: "indigo dyeing (aizome) and craft economies",
    slug: "tokushima-aizome",
    country: "Japan",
    status: "new",
    reason:
      "Mira Sol's illustrative beat: contemporary indigo practices in Tokushima. Prefecture-level craft " +
      "economy with documented maker communities, museum collections, and prefectural tourism records. " +
      "Outside North America/Europe; smaller-region coverage supports geographic balance. Strong source " +
      "availability expected (Japanese-language institutional pages, Wikipedia aizome entry, museum " +
      "collections, practitioner accounts).",
  },
  {
    id: "p-kumasi-kente",
    title: "Woven in Kumasi: the cloth that speaks first",
    persona_id: "mira-sol",
    place: "Kumasi, Ghana",
    practice: "kente weaving and pattern language",
    slug: "kumasi-kente-fixture",
    country: "Ghana",
    status: "new",
    reason:
      "STAGE-04 GATE-DEMO FIXTURE (isolated from real publication slots). Runs the full pipeline with a " +
      "forced unsupported-claim gate failure to demonstrate the hard-gate hold + reserve routing.",
  },
  {
    id: "p-dakar-griot",
    title: "The griot's memory: history told by voice",
    persona_id: "sasha-wren",
    place: "Dakar, Senegal",
    practice: "griot (gewel) oral tradition and praise poetry",
    slug: "dakar-griot-fixture",
    country: "Senegal",
    status: "new",
    reason:
      "STAGE-04 GATE-DEMO FIXTURE (isolated from real publication slots). Runs the full pipeline with a " +
      "forced image-rights gate failure to demonstrate unresolved image rights preventing 'ready'.",
  },
];

for (const p of PITCHES) {
  db.prepare(
    "INSERT OR IGNORE INTO pitches (id, title, persona_id, place, practice, status, score, reason, created_at, slug, country, deck) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
  ).run(p.id, p.title, p.persona_id, p.place, p.practice, p.status, p.score || null, p.reason, now, p.slug, p.country, p.deck || null);
}
console.log("pitches seeded:", db.prepare("SELECT COUNT(*) c FROM pitches").get().c);
for (const r of db.prepare("SELECT id, title, practice, status FROM pitches ORDER BY created_at").all()) console.log(" ", r.id, "-", r.practice, r.status);
