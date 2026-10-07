"use strict";
// Persisted one-shot reserve replenishment dispatcher. The platform scheduler invokes
// this early, independently of the fast morning publisher; no timer is created here.
const path=require("path");
const {spawnSync}=require("child_process");
const {openDb,settingsGetAll,audit}=require("../lib/db");
const {budgetStatus}=require("../lib/provider");
const schedule=require("../lib/scheduler");
const dbFile=process.env.FOLKLY_DB||path.join(__dirname,"..","folkly.db");
const db=openDb(dbFile);
let runId;
function slugify(s){return String(s??"").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu,"-").replace(/^-+|-+$/g,"").slice(0,80)||"item";}
function claimPitch(){
  db.exec("BEGIN IMMEDIATE");
  try{
    const settings=settingsGetAll(db),target=Number(settings["reserve.target"]||7);
    const ready=db.prepare("SELECT COUNT(*) n FROM articles WHERE pipeline_state='ready' AND status NOT IN ('published','withdrawn')").get().n;
    if(ready>=target){db.exec("COMMIT");return {done:true,ready,target};}
    if(budgetStatus(db).exhausted){audit(db,"replenishment","budget-cap-stop","production",runId,"budget exhausted; no new production started");db.exec("COMMIT");return {done:true,ready,target,budgetExhausted:true};}
    // Recover stale claims from an interrupted worker. The pipeline is resumable from its
    // persisted article state, so a reclaimed pitch continues from its checkpoint.
    db.prepare("UPDATE pitches SET status='retryable-failure' WHERE status='processing' AND EXISTS (SELECT 1 FROM production_runs r WHERE r.article_slug=COALESCE(pitches.slug,pitches.id) AND r.state='running' AND r.started_at < ?)").run(new Date(Date.now()-2*60*60*1000).toISOString());
    const pitch=db.prepare("SELECT * FROM pitches WHERE status IN ('new','retryable-failure') AND reason NOT LIKE 'STAGE-04 GATE-DEMO FIXTURE%' AND NOT EXISTS (SELECT 1 FROM articles a WHERE a.slug=COALESCE(pitches.slug,pitches.id) AND a.pipeline_state IN ('ready','needs-review','blocked','withdrawn')) ORDER BY created_at,id LIMIT 1").get();
    if(!pitch){db.exec("COMMIT");return {done:true,ready,target,queueEmpty:true};}
    const claimed=db.prepare("UPDATE pitches SET status='processing' WHERE id=? AND status IN ('new','retryable-failure')").run(pitch.id);
    if(claimed.changes!==1){db.exec("ROLLBACK");return null;}
    runId="replenish-"+Date.now()+"-"+process.pid+"-"+Math.random().toString(16).slice(2);
    db.prepare("INSERT INTO production_runs(id,article_slug,state,started_at) VALUES(?,?,'running',?)").run(runId,pitch.slug||slugify(pitch.title),new Date().toISOString());
    db.exec("COMMIT");return {pitch,ready,target};
  }catch(e){db.exec("ROLLBACK");throw e;}
}
try{
  schedule.ensure(db);
  let completed=0;
  for(let guard=0;guard<25;guard++){
    const claim=claimPitch();if(!claim)continue;
    if(claim.done){process.stdout.write(JSON.stringify({state:claim.budgetExhausted?"budget-exhausted":claim.queueEmpty?"queue-empty":"reserve-target-or-no-work",ready:claim.ready,target:claim.target,completed})+"\n");break;}
    const pitchStarted=Date.now();
    const result=spawnSync(process.execPath,[path.join(__dirname,"run-pipeline.js"),dbFile,claim.pitch.id],{
      cwd:path.join(__dirname,".."),encoding:"utf8",timeout:45*60*1000,windowsHide:true,maxBuffer:1024*1024
    });
    const article=db.prepare("SELECT id,slug,pipeline_state FROM articles WHERE slug=?").get(claim.pitch.slug||slugify(claim.pitch.title));
    const ready=article?.pipeline_state==="ready";
    const held=["needs-review","blocked","withdrawn"].includes(article?.pipeline_state);
    const state=ready?"ready":held?"needs-review":"retryable-failure";
    db.prepare("UPDATE pitches SET status=? WHERE id=?").run(ready?"done":state,claim.pitch.id);
    db.prepare("UPDATE production_runs SET state=?,finished_at=?,duration_ms=?,error=? WHERE id=?").run(state,new Date().toISOString(),Date.now()-pitchStarted,ready?null:String(article?.pipeline_state||result.error?.message||result.stderr||"pipeline did not reach ready").slice(0,500),runId);
    audit(db,"replenishment",ready?"pitch-ready":"pitch-failed","pitch",claim.pitch.id,"state="+state);
    completed++;
    if(!ready){process.stdout.write(JSON.stringify({state,completed,pitch_id:claim.pitch.id,ready:claim.ready,target:claim.target})+"\n");if(!held){process.exitCode=2;break;}}
  }
}catch(e){process.stderr.write(JSON.stringify({state:"replenishment-error",error:String(e.message||"").slice(0,400)})+"\n");process.exitCode=1;}
finally{db.close();}
