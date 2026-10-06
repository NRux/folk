"use strict";
// Stage 06 durable, idempotent publication core. One invocation publishes only today's
// Los Angeles slot. SQLite transactions are the publication lock and source of truth.
const crypto = require("crypto");
const { settingsGetAll, audit } = require("./db");
const TZ = "America/Los_Angeles";
const nowIso = () => new Date().toISOString();
function localParts(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date).map(x=>[x.type,x.value]));
  return p;
}
function localDate(date=new Date()) { const p=localParts(date); return p.year+"-"+p.month+"-"+p.day; }
function zonedInstant(day,time="07:00") {
  const [y,m,d]=day.split("-").map(Number),[hh,mm]=time.split(":").map(Number);
  const target=Date.UTC(y,m-1,d,hh,mm);let guess=target;
  const fmt=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
  for(let i=0;i<4;i++){const p=Object.fromEntries(fmt.formatToParts(new Date(guess)).map(x=>[x.type,x.value]));guess+=target-Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);}
  return new Date(guess);
}
function ensure(db) {
  // Avoid concurrent DDL on normal invocations: installation/migration creates this
  // registry once before runner calls begin.
  if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='scheduler_runs'").get()) return db;
  db.exec(`CREATE TABLE IF NOT EXISTS scheduler_runs(
    id TEXT PRIMARY KEY, slot_date TEXT NOT NULL, state TEXT NOT NULL, attempt INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL, finished_at TEXT, next_run_at TEXT, delay_seconds INTEGER NOT NULL DEFAULT 0,
    article_version_id TEXT, error TEXT, duration_ms INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_scheduler_retry ON scheduler_runs(state,next_run_at);
  CREATE TABLE IF NOT EXISTS admin_alerts(
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'open', message TEXT NOT NULL,
    slot_date TEXT, created_at TEXT NOT NULL, resolved_at TEXT
  );
  CREATE TABLE IF NOT EXISTS automation_state(
    name TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 0, checked_at TEXT NOT NULL, detail TEXT
  );
  CREATE TABLE IF NOT EXISTS production_runs(
    id TEXT PRIMARY KEY, article_slug TEXT, state TEXT NOT NULL, started_at TEXT NOT NULL,
    finished_at TEXT, duration_ms INTEGER NOT NULL DEFAULT 0, error TEXT
  );`);
  const cols=db.prepare("PRAGMA table_info(publication_slots)").all().map(x=>x.name);
  for(const [name,type] of [["scheduled_for","TEXT"],["attempts","INTEGER NOT NULL DEFAULT 0"],["last_error","TEXT"],["delay_seconds","INTEGER NOT NULL DEFAULT 0"],["readback_at","TEXT"],["readback_hash","TEXT"]]) if(!cols.includes(name)) db.exec("ALTER TABLE publication_slots ADD COLUMN "+name+" "+type);
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_slots_date_unique ON publication_slots(slot_date)");
  return db;
}
function opsState(db) {
  ensure(db);
  const active=db.prepare("SELECT * FROM publication_slots WHERE status IN ('missed','retryable-failure') ORDER BY slot_date DESC LIMIT 14").all();
  const alerts=db.prepare("SELECT * FROM admin_alerts WHERE state='open' ORDER BY created_at DESC LIMIT 20").all();
  const runs=db.prepare("SELECT id,slot_date,state,attempt,started_at,finished_at,next_run_at,delay_seconds,error,duration_ms FROM scheduler_runs ORDER BY started_at DESC LIMIT 20").all();
  const counts=db.prepare("SELECT COUNT(*) n FROM articles WHERE pipeline_state='ready' AND status!='published'").get().n;
  const automations=db.prepare("SELECT * FROM automation_state ORDER BY name").all();
  return { timezone:TZ,publishTime:settingsGetAll(db)["schedule.publish_time"]||"07:00", mechanism:"persisted-one-shot-runner", liveScheduleActive:false, readyReserve:counts, missedOrRetryable:active, alerts, runs, automations };
}
function beginImmediate(db) {
  for(let i=0;i<40;i++){try{db.exec("BEGIN IMMEDIATE");return;}catch(e){if(e.errcode!==5&&e.errcode!==6&&!/database is locked|database is busy/i.test(e.message))throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,25);}}
  db.exec("BEGIN IMMEDIATE");
}
function alert(db,kind,message,slotDate) {
  db.prepare("INSERT INTO admin_alerts(id,kind,state,message,slot_date,created_at) VALUES(?,?,'open',?,?,?)")
    .run("alert-"+crypto.randomUUID(),kind,String(message).slice(0,1000),slotDate,nowIso());
}
function eligible(db,article) {
  if(!article||article.pipeline_state!=="ready"||article.status==="published") return false;
  const ver=db.prepare("SELECT * FROM article_versions WHERE article_id=? ORDER BY version DESC LIMIT 1").get(article.id);
  if(!ver) return false;
  const sources=db.prepare("SELECT * FROM sources WHERE article_version_id=?").all(ver.id);
  const domains=new Set(sources.map(s=>{try{return new URL(s.url).hostname.replace(/^www\./,"").toLowerCase()}catch{return null}}).filter(Boolean));
  if(sources.length<5||domains.size<3) return false;
  const strong=sources.filter(x=>["primary","local","scholarly","institutional","practitioner"].includes(String(x.publisher||x.source_type||"").toLowerCase())).length;
  if(strong<2) return false;
  const claims=db.prepare("SELECT source_ids FROM claim_citations WHERE article_version_id=?").all(ver.id);
  if(!claims.length||claims.some(c=>{try{return !JSON.parse(c.source_ids||"[]").length}catch{return true}})) return false;
  const content=JSON.parse(ver.content_json||"{}");
  if(!/AI editorial persona/i.test(content.note?.text||"")||!/linked sources/i.test(content.note?.text||"")||!/no firsthand experience/i.test(content.note?.text||"")) return false;
  const checks=db.prepare("SELECT check_name,result FROM editorial_checks WHERE article_version_id=?").all(ver.id);
  const fails=checks.some(c=>c.result==="fail");
  if(fails) return false;
  return {article,version:ver};
}
function choose(db,slotDate) {
  const slot=db.prepare("SELECT * FROM publication_slots WHERE slot_date=?").get(slotDate);
  if(slot?.article_version_id) {
    const version=db.prepare("SELECT article_id FROM article_versions WHERE id=?").get(slot.article_version_id);
    const art=version&&db.prepare("SELECT * FROM articles WHERE id=?").get(version.article_id);
    const ok=eligible(db,art);
    if(ok&&ok.version.id===slot.article_version_id)return ok;
  }
  const candidates=db.prepare("SELECT * FROM articles WHERE pipeline_state='ready' AND status!='published' ORDER BY updated_at,id").all();
  for(const a of candidates){const ok=eligible(db,a);if(ok)return ok;}
  return null;
}
function recordFailure(db,date,error,{providerAvailable=true,at=new Date()}={}) {
  ensure(db);const timestamp=at.toISOString(),slotTime=zonedInstant(date,settingsGetAll(db)["schedule.publish_time"]||"07:00");
  const late=Math.max(0,Math.floor((at-slotTime)/1000));
  beginImmediate(db);
  try {
    db.prepare("INSERT INTO publication_slots(id,slot_date,status,scheduled_for,attempts,last_error,delay_seconds,note) VALUES(?,?,'retryable-failure',?,1,?,?,?) ON CONFLICT(slot_date) DO UPDATE SET status='retryable-failure',attempts=publication_slots.attempts+1,last_error=excluded.last_error,delay_seconds=excluded.delay_seconds,note=excluded.note")
      .run("slot-"+date,date,slotTime.toISOString(),String(error),late,providerAvailable?"publication missed; recover today's slot only":"publisher unavailable; site left intact");
    const id="scheduler-"+date+":"+crypto.randomUUID();
    db.prepare("INSERT INTO scheduler_runs(id,slot_date,state,attempt,started_at,finished_at,next_run_at,error,delay_seconds) VALUES(?,?,?,1,?,?,?,?,?)")
      .run(id,date,"retryable-failure",timestamp,timestamp,new Date(at.getTime()+5*60*1000).toISOString(),String(error),late);
    alert(db,providerAvailable?"publication-missed":"publisher-unavailable",String(error),date);
    db.exec("COMMIT");
    return {ok:false,state:"retryable-failure",slot_date:date,retry_at:new Date(at.getTime()+5*60*1000).toISOString()};
  } catch(e){db.exec("ROLLBACK");throw e;}
}
function publishToday(db,{at=new Date(),providerAvailable=true,simulateTimeoutAfterCommit=false}={}) {
  ensure(db);
  const date=localDate(at),settings=settingsGetAll(db),publishTime=settings["schedule.publish_time"]||"07:00";
  if(settings["schedule.enabled"]!=="true"||settings["publication.autonomous_enabled"]!=="true"||settings["autonomous.paused"]==="true") return {ok:false,state:"disabled",slot_date:date,reason:"publication or schedule switch is off, or autonomy is paused"};
  const slotInstant=zonedInstant(date,publishTime);
  const slotMs=+slotInstant;
  if(+at<slotMs)return {ok:false,state:"not-due",slot_date:date,scheduled_for:slotInstant.toISOString()};
  const existing=db.prepare("SELECT * FROM publication_slots WHERE slot_date=?").get(date);
  if(existing?.status==="published") {
    const read=readback(db,date);
    return read.ok?{ok:true,state:"already-published",...read}:{ok:false,state:"readback-failed",slot_date:date};
  }
  if(!providerAvailable) return recordFailure(db,date,"publisher unavailable; no publication attempted",{providerAvailable:false,at});
  const start=Date.now();let publishedVersion;
  db.exec("BEGIN IMMEDIATE");
  try {
    // Duplicate detection, current-version check and readiness gates are re-evaluated while
    // holding the write lock; owner edits cannot be overwritten by a stale publisher.
    const current=db.prepare("SELECT * FROM publication_slots WHERE slot_date=?").get(date);
    if(current?.status==="published"){db.exec("COMMIT");return {ok:true,state:"already-published",...readback(db,date)};}
    const picked=choose(db,date);
    if(!picked){db.exec("ROLLBACK");return recordFailure(db,date,"no eligible ready article; reserve empty",{providerAvailable:true,at});}
    const fresh=db.prepare("SELECT * FROM articles WHERE id=?").get(picked.article.id);
    const checked=eligible(db,fresh);
    if(!checked||checked.version.id!==picked.version.id) throw new Error("article changed or failed eligibility recheck inside publication transaction");
    const delay=Math.max(0,Math.floor((+at-slotMs)/1000)),atIso=at.toISOString();
    db.prepare("INSERT INTO publication_slots(id,slot_date,article_version_id,status,published_at,published_by,scheduled_for,attempts,delay_seconds,note) VALUES(?,?,?,'published',?,'scheduler',?,?,?,?) ON CONFLICT(slot_date) DO UPDATE SET article_version_id=excluded.article_version_id,status='published',published_at=excluded.published_at,published_by='scheduler',scheduled_for=excluded.scheduled_for,attempts=publication_slots.attempts+1,delay_seconds=excluded.delay_seconds,last_error=NULL,note=excluded.note")
      .run("slot-"+date,date,checked.version.id,atIso,slotInstant.toISOString(),1,delay,delay?"recovered same-day slot after "+delay+" seconds":"on-time publication");
    db.prepare("UPDATE articles SET status='published',pipeline_state='published',updated_at=? WHERE id=? AND status!='published'").run(atIso,checked.article.id);
    db.prepare("UPDATE articles SET is_cover=0 WHERE is_cover=1").run();
    db.prepare("UPDATE articles SET is_cover=1,home_position=0 WHERE id=?").run(checked.article.id);
    const runId="scheduler-"+date;
    db.prepare("INSERT INTO scheduler_runs(id,slot_date,state,attempt,started_at,finished_at,article_version_id,delay_seconds,duration_ms) VALUES(?,?, 'published',1,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET state='published',finished_at=excluded.finished_at,article_version_id=excluded.article_version_id,delay_seconds=excluded.delay_seconds,duration_ms=excluded.duration_ms,error=NULL")
      .run(runId,date,atIso,atIso,checked.version.id,delay,Date.now()-start);
    audit(db,"scheduler","publish-slot","publication_slot",date,"version="+checked.version.id+"; delay_seconds="+delay);
    publishedVersion=checked.version.id;
    db.exec("COMMIT");
  } catch(e) {try{db.exec("ROLLBACK")}catch{};return recordFailure(db,date,e.message,{providerAvailable:true,at});}
  if(simulateTimeoutAfterCommit) throw Object.assign(new Error("simulated response timeout after committed publication"),{code:"SIMULATED_TIMEOUT"});
  const result=readback(db,date);
  if(!result.ok){alert(db,"publication-readback-failed","Publication transaction committed but separate readback could not confirm content",date);return {ok:false,state:"readback-failed",slot_date:date,article_version_id:publishedVersion};}
  return {ok:true,state:"published",...result};
}
function readback(db,date) {
  ensure(db);
  const row=db.prepare("SELECT ps.slot_date,ps.status,ps.article_version_id,ps.published_at,ps.readback_at,a.slug,a.title,av.content_json FROM publication_slots ps JOIN article_versions av ON av.id=ps.article_version_id JOIN articles a ON a.id=av.article_id WHERE ps.slot_date=?").get(date);
  if(!row||row.status!=="published"||!row.content_json) return {ok:false,slot_date:date};
  const hash=crypto.createHash("sha256").update(row.content_json).digest("hex"),stamp=nowIso();
  db.prepare("UPDATE publication_slots SET readback_at=?,readback_hash=? WHERE slot_date=? AND status='published'").run(stamp,hash,date);
  return {ok:true,slot_date:date,status:row.status,article_version_id:row.article_version_id,slug:row.slug,title:row.title,published_at:row.published_at,readback_at:stamp,content_hash:hash};
}
function retryDue(db,{at=new Date(),providerAvailable=true}={}) {
  ensure(db);const date=localDate(at);
  const retry=db.prepare("SELECT * FROM publication_slots WHERE slot_date=? AND status IN ('missed','retryable-failure')").get(date);
  if(!retry)return {ok:false,state:"no-current-day-retry",slot_date:date};
  const run=db.prepare("SELECT next_run_at FROM scheduler_runs WHERE slot_date=? AND state='retryable-failure' ORDER BY started_at DESC LIMIT 1").get(date);
  if(run?.next_run_at&&new Date(run.next_run_at)>at)return {ok:false,state:"retry-backoff",retry_at:run.next_run_at};
  return publishToday(db,{at,providerAvailable});
}
module.exports={TZ,localDate,zonedInstant,ensure,opsState,eligible,publishToday,retryDue,readback};
