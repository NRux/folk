"use strict";
const assert=require("node:assert/strict"),fs=require("fs"),os=require("os"),path=require("path"),{DatabaseSync}=require("node:sqlite"),{Worker}=require("node:worker_threads");
const s=require("../lib/scheduler");
function temp(){return path.join(os.tmpdir(),"folkly-stage06-"+process.pid+"-"+Math.random().toString(16).slice(2)+".db");}
function seed(file,date="2026-03-10"){
 const db=new DatabaseSync(file);db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=10000; PRAGMA foreign_keys=ON;");
 db.exec(`CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT,updated_at TEXT);
 CREATE TABLE publication_slots(id TEXT PRIMARY KEY,slot_date TEXT NOT NULL UNIQUE,article_version_id TEXT,status TEXT DEFAULT 'open',published_at TEXT,published_by TEXT,note TEXT);
 CREATE TABLE articles(id TEXT PRIMARY KEY,slug TEXT,title TEXT,status TEXT,pipeline_state TEXT,updated_at TEXT,is_cover INTEGER DEFAULT 0,home_position INTEGER);
 CREATE TABLE article_versions(id TEXT PRIMARY KEY,article_id TEXT,version INTEGER,content_json TEXT);
 CREATE TABLE sources(id TEXT PRIMARY KEY,article_version_id TEXT,url TEXT,publisher TEXT);
 CREATE TABLE claim_citations(id TEXT PRIMARY KEY,article_version_id TEXT,source_ids TEXT);
 CREATE TABLE editorial_checks(id INTEGER PRIMARY KEY,article_version_id TEXT,check_name TEXT,result TEXT);
 CREATE TABLE audit_events(id INTEGER PRIMARY KEY,at TEXT,actor TEXT,action TEXT,entity TEXT,entity_id TEXT,reason TEXT);
 CREATE TABLE jobs(id TEXT PRIMARY KEY,job_type TEXT,status TEXT,attempt INTEGER DEFAULT 0,next_run_at TEXT,last_run_at TEXT,error TEXT);
 CREATE TABLE job_steps(id INTEGER PRIMARY KEY,job_id TEXT,step_name TEXT,status TEXT,attempt INTEGER,detail TEXT,at TEXT);
 INSERT INTO settings VALUES('schedule.publish_time','07:00',datetime('now')); INSERT INTO settings VALUES('schedule.enabled','true',datetime('now')); INSERT INTO settings VALUES('publication.autonomous_enabled','true',datetime('now'));
 INSERT INTO articles(id,slug,title,status,pipeline_state,updated_at) VALUES('a','test-feature','Test feature','draft','ready',datetime('now'));
 INSERT INTO article_versions VALUES('a-v1','a',1,'{"note":{"text":"AI editorial persona; linked sources; no firsthand experience."},"body_html":"<p>Evidence backed story.</p>"}');
 INSERT INTO sources(id,article_version_id,url,publisher) VALUES('s1','a-v1','https://one.example/a','primary'),('s2','a-v1','https://two.example/b','local'),('s3','a-v1','https://three.example/c','publisher'),('s4','a-v1','https://four.example/d','publisher'),('s5','a-v1','https://five.example/e','publisher');
 INSERT INTO claim_citations VALUES('c1','a-v1','["s1","s2"]');
 INSERT INTO editorial_checks(article_version_id,check_name,result) VALUES('a-v1','sources_present','pass');
 INSERT INTO audit_events(at,actor,action,entity,entity_id,reason) VALUES(datetime('now'),'pipeline-runner','persist-review','article','a','{"verdict":"pass","findings":[]}');`);
 s.ensure(db);return db;
}
async function main(){
 for(const [d,offset] of [["2026-03-07","GMT-8"],["2026-03-09","GMT-7"],["2026-10-31","GMT-7"],["2026-11-02","GMT-8"]]){const z=s.zonedInstant(d,"07:00"),p=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:s.TZ,hour:"2-digit",minute:"2-digit",hourCycle:"h23",timeZoneName:"shortOffset"}).formatToParts(z).map(x=>[x.type,x.value]));assert.equal(p.hour,"07");assert.equal(p.minute,"00");assert.equal(p.timeZoneName,offset);}
 const f=temp(),db=seed(f);const instant=s.zonedInstant("2026-03-10","08:00");
 let timeout=false;try{s.publishToday(db,{at:instant,simulateTimeoutAfterCommit:true})}catch(e){timeout=e.code==="SIMULATED_TIMEOUT"}assert(timeout);
 const retry=s.publishToday(db,{at:instant});assert.equal(retry.state,"already-published");assert.equal(db.prepare("SELECT COUNT(*) n FROM publication_slots WHERE status='published'").get().n,1);assert.equal(db.prepare("SELECT delay_seconds FROM publication_slots WHERE slot_date=?").get("2026-03-10").delay_seconds,3600);assert(s.readback(db,"2026-03-10").ok);db.close();fs.rmSync(f,{force:true});
 const f2=temp(),d1=seed(f2);d1.close();const t=s.zonedInstant("2026-03-10","08:00");const workerCode=`const {parentPort,workerData}=require("node:worker_threads");const {DatabaseSync}=require("node:sqlite");const sch=require(workerData.module);const db=new DatabaseSync(workerData.file);db.exec("PRAGMA busy_timeout=10000; PRAGMA foreign_keys=ON;");try{parentPort.postMessage(sch.publishToday(db,{at:new Date(workerData.at)}));}catch(e){parentPort.postMessage({workerError:e.stack});}finally{db.close();}`;const workers=[0,1].map(()=>new Promise((resolve,reject)=>{const w=new Worker(workerCode,{eval:true,workerData:{module:require.resolve("../lib/scheduler"),file:f2,at:+t}});let msg;w.once("message",m=>{msg=m});w.once("error",reject);w.once("exit",code=>code===0?resolve(msg):reject(new Error("worker exit "+code)));}));const results=await Promise.all(workers);const verify=new DatabaseSync(f2);assert.equal(verify.prepare("SELECT COUNT(*) n FROM publication_slots WHERE status='published'").get().n,1);assert(results.some(x=>x.state==="published")&&results.every(x=>x.ok),JSON.stringify(results));verify.close();fs.rmSync(f2,{force:true});
 const f3=temp(),d3=seed(f3);let r=s.publishToday(d3,{at:s.zonedInstant("2026-03-10","08:00"),providerAvailable:false});assert.equal(r.state,"retryable-failure");assert.equal(d3.prepare("SELECT COUNT(*) n FROM admin_alerts WHERE state='open'").get().n,1);r=s.retryDue(d3,{at:s.zonedInstant("2026-03-10","08:02"),providerAvailable:true});assert.equal(r.state,"retry-backoff");d3.close();fs.rmSync(f3,{force:true});
 const f4=temp(),d4=seed(f4);d4.prepare("DELETE FROM sources").run();r=s.publishToday(d4,{at:s.zonedInstant("2026-03-10","08:00")});assert.equal(r.state,"retryable-failure");assert.match(d4.prepare("SELECT last_error FROM publication_slots").get().last_error,/no eligible ready article/);d4.close();fs.rmSync(f4,{force:true});
 for(const [name,mutate] of [
  ["missing checks",db=>db.exec("DELETE FROM editorial_checks")],
  ["missing review",db=>db.exec("DELETE FROM audit_events WHERE action='persist-review'")],
  ["major review finding",db=>db.prepare("UPDATE audit_events SET reason=? WHERE action='persist-review'").run(JSON.stringify({verdict:"pass",findings:[{severity:"major"}]}))],
  ["unknown cited source",db=>db.prepare("UPDATE claim_citations SET source_ids=?").run('["missing-source"]')],
 ]){
  const file=temp(),candidate=seed(file);mutate(candidate);
  assert.equal(s.eligible(candidate,candidate.prepare("SELECT * FROM articles WHERE id='a'").get()),false,name);
  const blocked=s.publishToday(candidate,{at:s.zonedInstant("2026-03-10","08:00")});
  assert.equal(blocked.state,"retryable-failure",name);
  assert.equal(candidate.prepare("SELECT COUNT(*) n FROM articles WHERE status='published'").get().n,0,name);
  candidate.close();fs.rmSync(file,{force:true});
 }
 const f5=temp(),d5=seed(f5);r=s.publishToday(d5,{at:s.zonedInstant("2026-03-10","06:30")});assert.equal(r.state,"not-due");d5.close();fs.rmSync(f5,{force:true});
 console.log("Stage 06 scheduler tests passed (DST, concurrency, timeout retry, provider failure, empty reserve, backoff, readback).");
}
main().catch(e=>{console.error(e);process.exitCode=1;});

