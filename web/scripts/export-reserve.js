"use strict";
// Portable, credential-free release bundle for the Site/D1 data migration.
// Generated only after the read-only reserve acceptance gate succeeds.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const dbFile = path.resolve(process.argv[2] || process.env.FOLKLY_DB || path.join(__dirname,"..","folkly.db"));
const output = path.resolve(process.argv[3] || path.join(__dirname,"..","data","reserve-seed.json"));
execFileSync(process.execPath,[path.join(__dirname,"verify-reserve.js"),dbFile],{stdio:"pipe"});
const db=new DatabaseSync(dbFile,{readOnly:true});
try{
 const articles=db.prepare("SELECT * FROM articles WHERE pipeline_state='ready' AND status NOT IN ('scheduled','published','withdrawn') ORDER BY slug").all();
 const bundle={format:"folkly-reserve-v1",release_state:"unpublished",articles:articles.map(a=>{
   const v=db.prepare("SELECT id,version,content_json FROM article_versions WHERE article_id=? ORDER BY version DESC LIMIT 1").get(a.id);
   const sources=db.prepare("SELECT id,ord,title,org_author,url,pub_date,retrieved_at,lang,publisher,source_type FROM sources WHERE article_version_id=? ORDER BY ord").all(v.id);
   const claims=db.prepare("SELECT id,claim,source_ids,kind,verified FROM claim_citations WHERE article_version_id=? ORDER BY id").all(v.id).map(c=>({...c,source_ids:JSON.parse(c.source_ids)}));
   const review=JSON.parse(db.prepare("SELECT reason FROM audit_events WHERE entity_id=? AND action='persist-review' ORDER BY id DESC LIMIT 1").get(a.id).reason);
   return {article:{
     id:a.id,slug:a.slug,title:a.title,deck:a.deck,persona_id:a.persona_id,place_label:a.place_label,country:a.country,category:a.category,
     status:"draft",pipeline_state:"ready",word_count:a.word_count,reading_minutes:a.reading_minutes,content_hash:a.content_hash
   },version:{id:v.id,version:v.version,content:JSON.parse(v.content_json)},sources,claims,
   review:{verdict:review.verdict,minor_findings:(review.findings||[]).filter(f=>f.severity==="minor").map(f=>({type:f.type,article_text:f.article_text}))}};
 })};
 fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.writeFileSync(output,JSON.stringify(bundle,null,2)+"\n",{flag:"w",mode:0o600});
 console.log(JSON.stringify({output,articles:bundle.articles.length,bytes:fs.statSync(output).size}));
}finally{db.close();}
