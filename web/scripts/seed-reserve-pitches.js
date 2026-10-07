"use strict";
// Candidate backlog for Stage 07. These are pitches, never pre-approved articles.
const crypto = require("node:crypto");
const path = require("node:path");
const { openDb } = require("../lib/db");
const { scorePitch } = require("../lib/calendar");
const db = openDb(process.argv[2] || process.env.FOLKLY_DB || path.join(__dirname, "..", "folkly.db"));
const candidates = [
  { slug:"essaouira-gnaoua", title:"The gatherings behind Gnaoua music", persona_id:"ellis-reed", place:"Essaouira, Morocco", country:"Morocco", practice:"Gnaoua music, practitioners, and the Essaouira festival", reason:"Documented practitioner tradition and festival; investigate history, local musicians, and commercialization without treating ritual as spectacle." },
  { slug:"kimjang-seoul", title:"The shared work of kimjang", persona_id:"lena-march", place:"Seoul, South Korea", country:"South Korea", practice:"kimjang, communal kimchi making and food knowledge", reason:"Institutional and practitioner accounts can distinguish living household variation from heritage descriptions; examine collective preparation and change." },
  { slug:"xochimilco-chinampas", title:"The working islands of Xochimilco", persona_id:"rowan-pike", place:"Xochimilco, Mexico City, Mexico", country:"Mexico", practice:"chinampa agriculture, growers, and urban ecological infrastructure", reason:"Investigate growers and the contemporary economic and water conditions behind a living agricultural landscape; avoid romanticizing environmental pressure." },
  { slug:"nowruz-tajikistan", title:"How Nowruz is made together", persona_id:"sasha-wren", place:"Dushanbe, Tajikistan", country:"Tajikistan", practice:"Nowruz traditions, public celebration, and intergenerational teaching", reason:"Transnational tradition with local variation; focus on documented Tajik practitioner accounts, contemporary practice, and distinct forms of belonging." },
  { slug:"tnalak-lake-sebu", title:"The hands that carry T'nalak weaving", persona_id:"mira-sol", place:"Lake Sebu, Philippines", country:"Philippines", practice:"T'boli T'nalak weaving, abaca, and contemporary makers", reason:"Named makers and institutions can ground material process and economic choices; cultural and intellectual-property claims require careful attribution." },
  { slug:"castells-tarragona", title:"What holds a human tower", persona_id:"sasha-wren", place:"Tarragona, Spain", country:"Spain", practice:"castells, community groups, training, and public celebration", reason:"Documented local groups and heritage sources can explain cooperation, safety, and how participation changes across generations." },
  { slug:"havana-rumba", title:"The room a rumba makes", persona_id:"ellis-reed", place:"Havana, Cuba", country:"Cuba", practice:"Cuban rumba, neighborhood musicians, and transmission", reason:"Practitioner voices and institutional records offer a route into rumba as a living community practice. Distinguish Cuban rumba from other uses of the name and avoid invented observation." },
  { slug:"bonwire-kente", title:"The names woven into kente", persona_id:"lena-march", place:"Bonwire, Ghana", country:"Ghana", practice:"kente weaving, named designs, apprenticeships, and present-day livelihoods", reason:"UNESCO documentation, Ghanaian weaver testimony, and textile research can ground a living practice. Treat origin stories as traditions and dated interviews as historical evidence." },
  { slug:"matariki-puanga", title:"When the stars gather a new year", persona_id:"rowan-pike", place:"Aotearoa New Zealand", country:"New Zealand", practice:"Matariki, Puanga, regional Māori New Year traditions, and living maramataka knowledge", reason:"Iwi and Māori researcher perspectives, museum interpretation, and ceremony resources distinguish regional traditions and contemporary practice without generalizing across communities." },
];
try {
  for (const p of candidates) {
    const score = scorePitch(db, { title:p.title, place:p.place, practice:p.practice, persona_id:p.persona_id, country:p.country });
    db.prepare("INSERT OR IGNORE INTO pitches(id,title,persona_id,place,practice,status,score,reason,created_at,slug,country) VALUES(?,?,?,?,?,'new',?,?,?,?,?)")
      .run("p-"+p.slug,p.title,p.persona_id,p.place,p.practice,score.score,p.reason+" Editorial score: "+JSON.stringify(score).slice(0,900),new Date().toISOString(),p.slug,p.country);
  }
  // Direct owner-run pipeline jobs also settle their pitch rows. Do not mistake
  // a held article for an available queued candidate on the next replenishment.
  db.prepare(`UPDATE pitches SET status=(
    SELECT CASE WHEN a.pipeline_state='ready' THEN 'done' ELSE 'needs-review' END
    FROM articles a WHERE a.slug=pitches.slug
  ) WHERE id IN (${candidates.map(()=>"?").join(",")})
  AND status IN ('new','retryable-failure') AND EXISTS (
    SELECT 1 FROM articles a WHERE a.slug=pitches.slug
    AND a.pipeline_state IN ('ready','needs-review','blocked','withdrawn')
  )`).run(...candidates.map(p=>"p-"+p.slug));
  console.log(db.prepare("SELECT slug,persona_id,score,status FROM pitches WHERE id LIKE 'p-%' AND slug IN ("+candidates.map(()=>"?").join(",")+")").all(...candidates.map(p=>p.slug)));
} finally { db.close(); }
