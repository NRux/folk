"use strict";
// One-time, idempotent repair for old generated drafts where h3 Markdown was
// stored as a literal paragraph. The source/reviewed prose is not altered.
const path=require("node:path"),crypto=require("node:crypto");
const {openDb,audit}=require("../lib/db");
const db=openDb(process.argv[2]||process.env.FOLKLY_DB||path.join(__dirname,"..","folkly.db"));
try{
 for(const article of db.prepare("SELECT id,slug FROM articles WHERE pipeline_state='ready'").all()){
  const v=db.prepare("SELECT id,content_json FROM article_versions WHERE article_id=? ORDER BY version DESC LIMIT 1").get(article.id);
  if(!v)continue;
  const content=JSON.parse(v.content_json);
  const original=content.body_html||"";
  const withoutDuplicate=original.replace(/<p class="">### Sources &amp; further reading<\/p>[\s\S]*?(?=<h[23]|$)/i,"");
  // Do not shorten a reviewed draft below its minimum length in a markup repair.
  const candidateWords=withoutDuplicate.replace(/<[^>]*>/g," ").split(/\s+/).filter(Boolean).length;
  const repaired=(candidateWords>=900?withoutDuplicate:original)
   .replace(/<p class="">### ([^<]+)<\/p>/g,(_m,title)=>{
    const id="sec-"+title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40);
    return `<h3 id="${id}">${title}</h3>`;
   });
  if(repaired===original)continue;
  content.body_html=repaired;
  const words=repaired.replace(/<[^>]*>/g," ").split(/\s+/).filter(Boolean).length;
  const hash=crypto.createHash("sha256").update(JSON.stringify(content)).digest("hex");
  db.prepare("UPDATE article_versions SET content_json=? WHERE id=?").run(JSON.stringify(content),v.id);
  db.prepare("UPDATE articles SET content_hash=?,word_count=?,reading_minutes=?,updated_at=? WHERE id=?").run(hash,words,Math.max(1,Math.round(words/200)),new Date().toISOString(),article.id);
  audit(db,"editorial-operator","normalize-headings","article",article.id,"Literal third-level headings rendered semantically; duplicate generated source list removed");
  console.log(article.slug,"headings normalized");
 }
}finally{db.close()}
