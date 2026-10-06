"use strict";
const crypto = require("crypto");
const { authorizeOwner } = require("./admin-auth");
const { settingsGetAll, audit, DEFAULTS } = require("./db");
const { reserveStatus } = require("./calendar");
const scheduler = require("./scheduler");

const NOW = () => new Date().toISOString();
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
function json(res, status, value) { res.writeHead(status, { "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff" }); res.end(JSON.stringify(value)); }
function html(res, status, value) { res.writeHead(status, { "Content-Type":"text/html; charset=utf-8", "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff", "Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-src 'self'; img-src 'self' https: data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'" }); res.end(value); }
function existsTable(db, name) { return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name); }
function tableHas(db, table, col) { return existsTable(db, table) && db.prepare("SELECT 1 FROM pragma_table_info(?) WHERE name=?").get(table, col); }
function setting(db, key, value) { db.prepare("INSERT INTO settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at").run(key, String(value), NOW()); }
function localDate(tz, date = new Date()) { const p = new Intl.DateTimeFormat("en-CA", { timeZone:tz, year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(date); const x = Object.fromEntries(p.map(v=>[v.type,v.value])); return x.year+"-"+x.month+"-"+x.day; }
function pacificInstant(date,time,tz="America/Los_Angeles") {
  const [y,m,d]=date.split("-").map(Number),[hh,mm]=String(time||"07:00").split(":").map(Number);
  const target=Date.UTC(y,m-1,d,hh,mm),fmt=new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
  let guess=target;
  for(let i=0;i<3;i++){const parts=Object.fromEntries(fmt.formatToParts(new Date(guess)).map(x=>[x.type,x.value]));const represented=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute);guess+=target-represented;}
  return new Date(guess);
}
function pacificLabel(date, time) {
  if (!date) return "No publication slot scheduled";
  const d = pacificInstant(date,time);
  const f = new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"});
  return f.format(d);
}
function budget(db) { try { const p=require("./provider"); return p.budgetStatus(db); } catch { return { unavailable:true }; } }
function currentAutomationState(db, name) {
  if (!existsTable(db,"automation_state")) return { state:"unavailable", reason:"Scheduler registry is not installed (Stage 06)." };
  try{const row=db.prepare("SELECT enabled, checked_at, detail FROM automation_state WHERE name=?").get(name);return row ? { state:row.enabled ? "enabled":"disabled", checked_at:row.checked_at, detail:row.detail } : { state:"unavailable", reason:"No scheduler status record." };}catch{return {state:"unavailable",reason:"Scheduler state schema is unavailable."};}
}
function dashboard(db) {
  const s=settingsGetAll(db), tz="America/Los_Angeles", today=localDate(tz);
  const next=db.prepare("SELECT * FROM publication_slots WHERE slot_date >= ? AND status IN ('open','assigned','filled') ORDER BY slot_date LIMIT 1").get(today);
  const todaySlot=db.prepare("SELECT * FROM publication_slots WHERE slot_date=?").get(today);
  const nextArticle=db.prepare("SELECT id,slug,title,pipeline_state,hold_reason,status,updated_at FROM articles WHERE pipeline_state NOT IN ('published','withdrawn') ORDER BY CASE pipeline_state WHEN 'ready' THEN 0 ELSE 1 END, updated_at DESC LIMIT 1").get();
  const reserve=reserveStatus(db);
  const failures=db.prepare("SELECT j.id,j.job_type,j.status,j.last_run_at,j.error,(SELECT step_name FROM job_steps s WHERE s.job_id=j.id AND s.status='failed' ORDER BY s.id DESC LIMIT 1) failed_step FROM jobs j WHERE j.status IN ('failed','retryable-failure') ORDER BY COALESCE(j.last_run_at,j.next_run_at) DESC LIMIT 8").all();
  const spend=budget(db);
  const scheduling=scheduler.opsState(db);
  const pipeline=db.prepare("SELECT id,slug,title,pipeline_state,hold_reason,updated_at FROM articles WHERE pipeline_state NOT IN ('published','withdrawn') ORDER BY updated_at DESC LIMIT 30").all();
  const calendar=db.prepare("SELECT * FROM publication_slots WHERE slot_date>=? ORDER BY slot_date LIMIT 14").all(today);
  return { today, timezone:tz, nextPublication:next?{date:next.slot_date,time:s["schedule.publish_time"]||"07:00",label:pacificLabel(next.slot_date,s["schedule.publish_time"])}:null,
    todaySlot:todaySlot||null, nextArticle:nextArticle||null, reserve, failures, spend, calendar, pipeline, scheduling,
    automations:{production:currentAutomationState(db,"production"),publication:currentAutomationState(db,"publication")},
    config:{production:s["production.autonomous_enabled"]==="true",publication:s["publication.autonomous_enabled"]==="true",paused:s["autonomous.paused"]==="true",schedule:s["schedule.enabled"]==="true"} };
}
function articleRecord(db,id) {
  const article=db.prepare("SELECT * FROM articles WHERE id=? OR slug=?").get(id,id); if(!article)return null;
  const versions=db.prepare("SELECT id,version,created_by,note,created_at FROM article_versions WHERE article_id=? ORDER BY version DESC").all(article.id);
  const latest=versions[0] ? db.prepare("SELECT * FROM article_versions WHERE id=?").get(versions[0].id) : null;
  const content=latest?JSON.parse(latest.content_json):null;
  const sources=latest?db.prepare("SELECT id,ord,title,org_author,url,pub_date,publisher,source_type,independence_rank,supports_claims,excerpt FROM sources WHERE article_version_id=? ORDER BY ord").all(latest.id):[];
  const claims=latest?db.prepare("SELECT claim,source_ids,kind,verified FROM claim_citations WHERE article_version_id=?").all(latest.id).map(c=>({...c,source_ids:JSON.parse(c.source_ids||"[]")})):[];
  const checks=latest?db.prepare("SELECT check_name,check_type,result,details,created_at FROM editorial_checks WHERE article_version_id=? ORDER BY id").all(latest.id):[];
  const imageAssets=latest&&content?.figure?.src?db.prepare("SELECT * FROM media_assets WHERE file_path=?").all(content.figure.src):[];
  return {article,versions,content,sources,claims,checks,imageAssets};
}
function articleVersionBody(db,id,version){const row=db.prepare("SELECT v.version,v.note,v.created_at,v.content_json FROM article_versions v JOIN articles a ON a.id=v.article_id WHERE (a.id=? OR a.slug=?) AND v.version=?").get(id,id,Number(version));return row?{version:row.version,note:row.note,created_at:row.created_at,content:JSON.parse(row.content_json)}:null;}
function page(db, query) {
  const d=dashboard(db);
  const personaBalance=require("./calendar").personaUsage(db).counts;
  const articles=db.prepare("SELECT id,slug,title,pipeline_state,hold_reason,status FROM articles ORDER BY updated_at DESC LIMIT 80").all();
  const personas=db.prepare("SELECT * FROM personas ORDER BY name").all().map(p=>{
    const briefs=db.prepare("SELECT version,brief_json,created_at FROM persona_briefs WHERE persona_id=? ORDER BY version DESC").all(p.id);
    return {...p,briefs:briefs.map(b=>({...b,brief:JSON.parse(b.brief_json)}))};
  });
  const article=query.get("article")?articleRecord(db,query.get("article")):null;
  const s=settingsGetAll(db);
  const exclusions=JSON.parse(s["topic.exclusions"]||"[]");
  const card=(title,value,detail="")=>'<article class="card"><span>'+esc(title)+'</span><strong>'+esc(value)+'</strong><small>'+esc(detail)+'</small></article>';
  const pipelineRows=d.pipeline.map(a=>'<tr><td><a href="/admin?article='+encodeURIComponent(a.id)+'">'+esc(a.title)+'</a></td><td>'+esc(a.pipeline_state)+'</td><td>'+esc(a.hold_reason||"—")+'</td></tr>').join("");
  const calRows=d.calendar.map(x=>'<tr><td>'+esc(x.slot_date)+'</td><td>'+esc(x.status)+'</td><td>'+esc(x.published_at||"—")+'</td><td>'+esc(x.note||"")+'</td></tr>').join("");
  const failRows=d.failures.map(x=>'<tr><td>'+esc(x.job_type)+'</td><td>'+esc(x.status)+'</td><td>'+esc(x.error||"")+'</td><td><button data-action="retry" data-id="'+esc(x.id)+'" data-step="'+esc(x.failed_step||"")+'">Retry '+esc(x.failed_step||"failed job")+'</button></td></tr>').join("");
  const articleRows=articles.map(a=>'<tr><td><a href="/admin?article='+encodeURIComponent(a.id)+'">'+esc(a.title)+'</a></td><td>'+esc(a.status)+'</td><td>'+esc(a.pipeline_state)+'</td><td>'+esc(a.hold_reason||"—")+'</td><td><button data-action="unpublish" data-id="'+esc(a.id)+'">Unpublish</button></td></tr>').join("");
  const personaCards=personas.map(p=>{
    const brief=p.briefs[0]?.brief||{};
    return '<details><summary>'+esc(p.name)+' · '+(p.active?'active':'inactive')+'</summary><p>Brief history: '+p.briefs.length+' version(s) · recent slot balance: '+(personaBalance[p.id]||0)+'</p><pre>'+esc(JSON.stringify(brief,null,2))+'</pre><form data-action="persona"><input type="hidden" name="persona_id" value="'+esc(p.id)+'"><label>Voice brief JSON<textarea name="brief_json" required>'+esc(JSON.stringify(brief,null,2))+'</textarea></label><label><input type="checkbox" name="active" '+(p.active?'checked':'')+'> Active</label><button>Save new brief version</button></form></details>';
  }).join("");
  const budgetText=d.spend.unavailable?"Unavailable":'$'+Number(d.spend.day?.spent||0).toFixed(2)+" today / $"+Number(d.spend.month?.spent||0).toFixed(2)+" this month";
  let detail="";
  if(article) {
    const c=article.content||{};
    detail='<section class="panel"><h2>'+esc(article.article.title)+'</h2><p>Pipeline: '+esc(article.article.pipeline_state)+' · blocked because: '+esc(article.article.hold_reason||"no active hold")+'</p><h3>Draft preview</h3><iframe sandbox="" title="Isolated draft preview" srcdoc="'+esc('<!doctype html><meta charset=utf-8><style>body{font:16px/1.65 Georgia,serif;max-width:48rem;margin:2rem auto;padding:0 1rem}h1{font-size:2rem}</style><h1>'+esc(article.article.title)+'</h1><p>'+esc(c.deck||"")+'</p>'+sanitizeArticleHtml(c.body_html||"") )+'"></iframe><form data-action="edit"><input type="hidden" name="article_id" value="'+esc(article.article.id)+'"><label>Title<input name="title" value="'+esc(article.article.title)+'" required></label><label>Deck<input name="deck" value="'+esc(c.deck||article.article.deck||"")+'"></label><label>Article HTML<textarea name="body_html" required>'+esc(c.body_html||"")+'</textarea></label><label>Reason for edit<input name="reason" required></label><button>Save and revalidate</button></form><h3>Versions</h3><ol>'+article.versions.map(v=>'<li>v'+v.version+' · '+esc(v.created_by)+' · '+esc(v.created_at)+' · '+esc(v.note||"")+' <button data-action="restore" data-id="'+esc(article.article.id)+'" data-version="'+v.version+'">Restore as new version</button></li>').join("")+'</ol><h3>Compare versions</h3><label>From version<select id="compare-a">'+article.versions.map(v=>'<option value="'+v.version+'">v'+v.version+'</option>').join("")+'</select></label><label>To version<select id="compare-b">'+article.versions.map(v=>'<option value="'+v.version+'">v'+v.version+'</option>').join("")+'</select></label><button data-action="compare" data-id="'+esc(article.article.id)+'">Compare</button><pre id="compare-result"></pre><h3>Source ledger</h3><ul>'+article.sources.map(s=>'<li><a href="'+esc(s.url)+'" rel="noopener noreferrer">'+esc(s.title)+'</a> — '+esc(s.publisher||s.org_author||"")+' <small>'+esc(s.excerpt||"")+'</small></li>').join("")+'</ul><h3>Image credits</h3><ul>'+article.imageAssets.map(m=>'<li>'+esc(m.attribution||m.creator||"")+' · '+esc(m.license||"")+' · '+esc(m.license_url||"")+'</li>').join("")+'</ul><h3>Verification results</h3><ul>'+article.checks.map(c=>'<li>'+esc(c.check_name)+': '+esc(c.result)+' — '+esc(c.details||"")+'</li>').join("")+'</ul><h3>Claim citations</h3><pre>'+esc(JSON.stringify(article.claims,null,2))+'</pre><label>Correction note<input id="correction" placeholder="Describe the correction"></label><button data-action="correction" data-id="'+esc(article.article.id)+'">Save correction note and revalidate</button><button data-action="publish" data-id="'+esc(article.article.id)+'">Publish now with explicit intent</button></section>';
  } else if(query.get("article")) detail='<section class="panel"><p>Article not found.</p></section>';
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Folkly control room</title><style>'+CSS+'</style><header><a href="/admin">Folkly <b>/ Control room</b></a><span>Private editorial workspace</span></header><main><h1>Editorial control room</h1><p class="sub">Operational status and owner controls for the publishing pipeline.</p><section class="grid">'+card("Next publication",d.nextPublication?.label||"None scheduled","America/Los_Angeles")+
    card("Today's slot",d.todaySlot?.status||"No slot",d.todaySlot?.note||"No recorded outcome")+
    card("Next article",d.nextArticle?.title||"No article in pipeline",d.nextArticle?.pipeline_state||"")+
    card("Ready reserve",d.reserve.ready+" / "+d.reserve.target,(d.reserve.shortfall||0)+" short of target")+
    card("Recent failures",String(d.failures.length),"Only persisted failed jobs")+
    card("Spend",budgetText,"Reported by the spend ledger")+
    card("Scheduler",d.scheduling?.liveScheduleActive?"Active":"Inactive",d.scheduling?.mechanism+"; "+d.scheduling?.readyReserve+" ready; live schedule held until Stage 08")+
    card("Automatic production",d.automations.production.state,d.automations.production.reason||d.automations.production.checked_at||"")+
    card("Automatic publication",d.automations.publication.state,d.automations.publication.reason||d.automations.publication.checked_at||"")+'</section><section class="panel"><h2>Operation</h2><p>Autonomous operation: '+(d.config.paused?'paused':'not paused')+'. Production setting: '+(d.config.production?'on':'off')+'. Publication setting: '+(d.config.publication?'on':'off')+'. Scheduler: '+(d.config.schedule?'preference on':'preference off')+'.</p><button data-action="pause" data-value="'+(d.config.paused?'false':'true')+'">'+(d.config.paused?'Resume':'Pause')+' autonomous operation</button><button data-action="toggle" data-key="production.autonomous_enabled" data-value="'+(!d.config.production)+'">Toggle automatic production</button><button data-action="toggle" data-key="publication.autonomous_enabled" data-value="'+(!d.config.publication)+'">Toggle automatic publication</button><p class="notice">Automation enabled state: '+esc(d.automations.production.reason||d.automations.publication.reason||"Read from scheduler registry.")+'</p></section><section class="panel"><h2>Scheduler recovery and alerts</h2><p>Persisted scheduler state. Missed/retryable slots and open alerts:</p><pre>'+esc(JSON.stringify(d.scheduling||{},null,2))+'</pre></section><section class="panel"><h2>Pipeline and holds</h2><table><thead><tr><th>Article</th><th>Stage</th><th>Blocked reason</th></tr></thead><tbody>'+pipelineRows+'</tbody></table></section><section class="panel"><h2>Calendar</h2><table><thead><tr><th>Pacific date</th><th>Slot</th><th>Outcome time</th><th>Note</th></tr></thead><tbody>'+calRows+'</tbody></table></section><section class="panel"><h2>Recent failures</h2><table><thead><tr><th>Job</th><th>Status</th><th>Reason</th><th></th></tr></thead><tbody>'+failRows+'</tbody></table></section>'+detail+'<section class="panel"><h2>Drafts and versions</h2><table><thead><tr><th>Article</th><th>Publication</th><th>Pipeline</th><th>Hold reason</th><th></th></tr></thead><tbody>'+articleRows+'</tbody></table></section><section class="panel"><h2>Personas and voice history</h2>'+personaCards+'</section><section class="panel"><h2>Topics, exclusions, assignments</h2><form data-action="topic"><label>Topic title<input name="title" required></label><label>Place<input name="place" required></label><label>Practice<input name="practice" required></label><label>Country<input name="country"></label><label>Persona<select name="persona_id"><option value="">Auto assign</option>'+personas.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join("")+'</select></label><label>Schedule date (optional)<input type="date" name="slot_date"></label><label>Reason<textarea name="reason" required></textarea></label><button>Add topic and assignment</button></form><p>Current exclusions: '+esc(exclusions.join(", ")||"None")+'</p><form data-action="exclude"><label>Exclude topic/place<input name="value" required></label><button>Add exclusion</button></form><form data-action="replace"><label>Ready article ID for the slot tomorrow<input name="article_id" required></label><button>Replace the story for tomorrow</button></form></section><section class="panel"><h2>Settings</h2><form data-action="settings">'+Object.keys(DEFAULTS).filter(k=>!k.startsWith("site.")).map(k=>'<label>'+esc(k)+'<input name="'+esc(k)+'" value="'+esc(s[k]||"")+'"></label>').join("")+'<label>Model ID<input name="provider.llm.model" value="'+esc(s["provider.llm.model"]||"")+'"></label><label>Editorial policy JSON<textarea name="editorial.policy_json">'+esc(s["editorial.policy_json"]||"{}")+'</textarea></label><button>Save settings</button></form></section><output id="result" aria-live="polite"></output><a href="/signout-with-chatgpt?return_to=%2F">Sign out</a></main><script>'+SCRIPT+'</script></html>';
}
const CSS=`*{box-sizing:border-box}body{margin:0;background:#f3f2ef;color:#242724;font:16px/1.5 Georgia,serif}header{display:flex;justify-content:space-between;padding:1rem 4vw;background:#192e2a;color:#fff}header a{color:inherit;text-decoration:none;font-size:1.2rem}main{max-width:1240px;margin:2rem auto;padding:0 1.3rem}h1,h2,h3{font-family:Arial,sans-serif;line-height:1.2}h1{font-size:2rem}h2{font-size:1.35rem;border-bottom:1px solid #c8cec9;padding-bottom:.5rem}.sub,small{color:#5c6660}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.8rem}.card,.panel{background:#fff;border:1px solid #d9ddd9;padding:1rem;margin:1rem 0;border-radius:4px}.card span,.card small{display:block}.card strong{display:block;font:600 1.12rem Arial,sans-serif;margin:.6rem 0;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:.55rem;border-bottom:1px solid #e5e7e5;vertical-align:top}button{background:#20473f;color:#fff;border:0;border-radius:3px;padding:.6rem .8rem;margin:.3rem;cursor:pointer}button:hover{background:#15332e}label{display:block;margin:.7rem 0;font:14px Arial,sans-serif}input,textarea,select{display:block;width:100%;font:16px Arial,sans-serif;padding:.55rem;border:1px solid #9ca79f;border-radius:3px;margin-top:.2rem}textarea{min-height:7rem}iframe{width:100%;height:32rem;background:#fff;border:1px solid #d9ddd9}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f6f4;padding:.7rem}.notice{color:#545d57}output{position:sticky;bottom:1rem;display:block;background:#fff;padding:.8rem}a{color:#1e6257}@media(max-width:640px){header{display:block}td,th{padding:.35rem;font-size:.9rem}}`;
const SCRIPT=`const out=document.querySelector("#result");async function send(action,data={}){out.textContent="Saving…";try{const r=await fetch("/api/admin/"+action,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});const j=await r.json();out.textContent=j.message||j.error||("HTTP "+r.status);if(r.ok)location.reload()}catch(e){out.textContent="Request failed"}}document.querySelectorAll("form[data-action]").forEach(f=>f.addEventListener("submit",e=>{e.preventDefault();const d=Object.fromEntries(new FormData(f));if(f.dataset.action==="settings"||f.dataset.action==="persona"){if(f.dataset.action==="settings"){const x={};for(const [k,v] of Object.entries(d))x[k]=v;d.settings=x}else{d.active=f.querySelector('[name=active]').checked;try{d.brief_json=JSON.parse(d.brief_json)}catch{out.textContent="Brief must be valid JSON";return}}}send(f.dataset.action,d)}));document.querySelectorAll("button[data-action]").forEach(b=>b.addEventListener("click",async()=>{if(b.dataset.action==="compare"){const a=document.querySelector("#compare-a").value,c=document.querySelector("#compare-b").value;const r=await fetch("/api/admin/compare?id="+encodeURIComponent(b.dataset.id)+"&a="+a+"&b="+c);const j=await r.json();document.querySelector("#compare-result").textContent=JSON.stringify(j,null,2);return}let d={id:b.dataset.id,article_id:b.dataset.id,version:b.dataset.version,value:b.dataset.value,key:b.dataset.key,step_name:b.dataset.step};if(b.dataset.action==="correction")d.note=document.querySelector("#correction").value;if(b.dataset.action==="publish"){if(!confirm("Publish this ready article immediately? This is an explicit owner action."))return;d.intent="Publish this article immediately"}send(b.dataset.action,d)}));`;
async function readBody(req) {
  const chunks=[];let size=0;
  for await(const c of req){size+=c.length;if(size>65536)throw Object.assign(new Error("request body too large"),{status:413});chunks.push(c);}
  const raw=Buffer.concat(chunks).toString("utf8");
  if(req.headers["content-type"]?.includes("application/json"))return JSON.parse(raw||"{}");
  if(req.headers["content-type"]?.includes("application/x-www-form-urlencoded"))return Object.fromEntries(new URLSearchParams(raw));
  throw Object.assign(new Error("JSON body required"),{status:415});
}
function checkOrigin(req) {
  const origin=req.headers.origin;
  if(!origin)return false;
  let expected;
  if(process.env.FOLKLY_CANONICAL_ORIGIN) expected=new URL(process.env.FOLKLY_CANONICAL_ORIGIN).origin;
  else expected=(req.headers["x-forwarded-proto"]==="https"?"https":"http")+"://"+req.headers.host;
  try{return new URL(origin).origin===expected;}catch{return false;}
}

function sanitizeArticleHtml(input) {
  let source=String(input||"").slice(0,60000)
    .replace(/<!--([\s\S]*?)-->/g,"")
    .replace(/<(script|style|iframe|object|embed|svg|math|template|form|video|audio)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,"")
    .replace(/<(script|style|iframe|object|embed|svg|math|template|form|video|audio)\b[^>]*\/?\s*>/gi,"");
  const allowed=new Set(["p","h2","h3","h4","strong","em","sup","sub","blockquote","ul","ol","li","a","br","hr"]);
  return source.replace(/<\/?([a-z][a-z0-9-]*)\b([^>]*)>/gi,(whole,rawTag,attrs)=>{
    const tag=rawTag.toLowerCase(); if(!allowed.has(tag))return "";
    if(whole.startsWith("</"))return ["br","hr"].includes(tag)?"":"</"+tag+">";
    if(tag==="p"&&/\bclass\s*=\s*["']lead["']/i.test(attrs))return '<p class="lead">';
    if(tag==="h2"){const id=attrs.match(/\bid\s*=\s*["'](sec-[a-z0-9-]{1,48})["']/i);return id?'<h2 id="'+id[1]+'">':"<h2>";}
    if(tag==="a"){const href=attrs.match(/\bhref\s*=\s*["']([^"']{1,2048})["']/i);if(!href)return "<a>";const value=href[1];if(value==="#sources")return '<a href="#sources">';try{const u=new URL(value);if(["http:","https:"].includes(u.protocol))return '<a href="'+esc(u.href)+'" rel="noopener noreferrer">';}catch{}return "<a>";}
    return "<"+tag+">";
  });
}
function articleVersionSave(db, articleId, input, actor, note) {
  const art=db.prepare("SELECT * FROM articles WHERE id=?").get(articleId);if(!art)throw Object.assign(new Error("article not found"),{status:404});
  const prior=db.prepare("SELECT * FROM article_versions WHERE article_id=? ORDER BY version DESC LIMIT 1").get(articleId);
  let content=prior?JSON.parse(prior.content_json):{};
  const title=input.title!==undefined?String(input.title).trim().slice(0,160):String(input._admin_title||art.title).slice(0,160);
  if(!title)throw Object.assign(new Error("article title is required"),{status:400});
  content._admin_title=title;
  if(input.deck!==undefined)content.deck=String(input.deck).slice(0,1200);
  if(input.body_html!==undefined)content.body_html=sanitizeArticleHtml(input.body_html);
  const max=db.prepare("SELECT COALESCE(MAX(version),0) n FROM article_versions WHERE article_id=?").get(articleId).n;
  const version=max+1, id=articleId+"-v"+version, at=NOW(), raw=JSON.stringify(content);
  const hash=crypto.createHash("sha256").update(raw).digest("hex");
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("INSERT INTO article_versions(id,article_id,version,content_json,created_by,note,created_at) VALUES(?,?,?,?,?,?,?)").run(id,articleId,version,raw,actor,note,at);
    const sourceRows=prior?db.prepare("SELECT * FROM sources WHERE article_version_id=? ORDER BY ord").all(prior.id):[];
    const idMap=new Map();
    for(const src of sourceRows){const nid=crypto.randomUUID();idMap.set(src.id,nid);db.prepare("INSERT INTO sources(id,article_version_id,ord,title,org_author,url,pub_date,retrieved_at,lang,publisher,source_type,independence_rank,supports_claims,excerpt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(nid,id,src.ord,src.title,src.org_author,src.url,src.pub_date,src.retrieved_at,src.lang,src.publisher,src.source_type,src.independence_rank,src.supports_claims,src.excerpt);}
    if(prior)for(const c of db.prepare("SELECT * FROM claim_citations WHERE article_version_id=?").all(prior.id)){const newIds=JSON.parse(c.source_ids||"[]").map(x=>idMap.get(x)).filter(Boolean);db.prepare("INSERT INTO claim_citations(id,article_version_id,claim,source_ids,kind,verified) VALUES(?,?,?,?,?,?)").run(crypto.randomUUID(),id,c.claim,JSON.stringify(newIds),c.kind,0);}
    db.prepare("UPDATE articles SET title=?,deck=?,content_hash=?,word_count=?,reading_minutes=?,status='draft',pipeline_state='verification',hold_reason=NULL,updated_at=? WHERE id=?").run(title,content.deck||"",hash,(content.body_html||"").replace(/<[^>]*>/g," ").split(/\s+/).filter(Boolean).length,Math.max(1,Math.ceil((content.body_html||"").replace(/<[^>]*>/g," ").split(/\s+/).filter(Boolean).length/220)),at,articleId);
    db.prepare("INSERT INTO jobs(id,job_type,status,next_run_at) VALUES(?,?,?,?)").run("revalidate:"+articleId+":v"+version,"revalidate-article","pending",at);
    audit(db,actor,"owner-edit-revalidate","article",articleId,"new content version "+version+": "+note);
    db.exec("COMMIT");
  } catch(e){db.exec("ROLLBACK");throw e;}
  return {version,id};
}
function api(db, req, res, pathname) {
  const auth=authorizeOwner(req);
  if(!auth.ok)return json(res,auth.status,{error:auth.error});
  if(req.method==="GET") {
    if(pathname==="/api/admin/dashboard")return json(res,200,dashboard(db));
    if(pathname==="/api/admin/article") {const id=new URL(req.url,"http://local").searchParams.get("id");const row=articleRecord(db,id||"");return row?json(res,200,row):json(res,404,{error:"article not found"});}
    if(pathname==="/api/admin/compare") {const u=new URL(req.url,"http://local"),id=u.searchParams.get("id"),left=articleVersionBody(db,id,u.searchParams.get("a")),right=articleVersionBody(db,id,u.searchParams.get("b"));return left&&right?json(res,200,{left,right}):json(res,404,{error:"version not found"});}
    return json(res,404,{error:"not found"});
  }
  if(req.method!=="POST")return json(res,405,{error:"method not allowed"});
  if(!checkOrigin(req))return json(res,403,{error:"same-origin request required"});
  readBody(req).then(body=>{
    const action=pathname.replace("/api/admin/","");
    const actor=auth.actor;
    try {
      if(action==="settings"){
        const allowed=new Set([...Object.keys(DEFAULTS).filter(k=>!k.startsWith("site.")),"provider.llm.model","editorial.policy_json","schedule.paused_until"]);
        const incoming=body.settings||{}, current=settingsGetAll(db), next={...current};
        for(const [key,value] of Object.entries(incoming)){
          if(!allowed.has(key))throw Object.assign(new Error("setting not allowed: "+key),{status:400});
          const v=String(value);
          if(v.length>4000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw Object.assign(new Error("invalid setting value"),{status:400});
          if(key==="schedule.publish_time"&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(v))throw Object.assign(new Error("publish time must use HH:MM"),{status:400});
          if(key.startsWith("budget.")&&(!/^\d+(\.\d{1,2})?$/.test(v)||Number(v)<=0||Number(v)>(key==="budget.daily_usd"?1000:10000)))throw Object.assign(new Error("budget cap is outside the supported positive range"),{status:400});
          if(key.startsWith("article.length_")&&(!/^\d+$/.test(v)||Number(v)<300||Number(v)>8000))throw Object.assign(new Error("article length must be between 300 and 8000 words"),{status:400});
          if(key==="reserve.target"&&(!/^\d+$/.test(v)||Number(v)<1||Number(v)>1000))throw Object.assign(new Error("reserve target must be between 1 and 1000"),{status:400});
          if(key.endsWith("enabled")&&!["true","false"].includes(v))throw Object.assign(new Error("switch must be true or false"),{status:400});
          if(key==="editorial.policy_json"||key==="schedule.exclusions"){let parsed;try{parsed=JSON.parse(v);}catch{throw Object.assign(new Error(key+" must be valid JSON"),{status:400});}if(key==="editorial.policy_json"&&(!parsed||typeof parsed!=="object"||Array.isArray(parsed)))throw Object.assign(new Error("editorial policy must be a JSON object"),{status:400});if(key==="schedule.exclusions"&&!Array.isArray(parsed))throw Object.assign(new Error("schedule exclusions must be a JSON array"),{status:400});}
          next[key]=v;
        }
        const min=Number(next["article.length_min"]),tmin=Number(next["article.length_typical_min"]),tmax=Number(next["article.length_typical_max"]),max=Number(next["article.length_max"]);
        if(!(min<=tmin&&tmin<=tmax&&tmax<=max))throw Object.assign(new Error("article length bands must be ordered min ≤ typical min ≤ typical max ≤ max"),{status:400});
        for(const [key,value] of Object.entries(incoming))setting(db,key,String(value));
        audit(db,actor,"settings-update","settings",null,JSON.stringify(incoming).slice(0,1000));
        return json(res,200,{message:"Settings saved."});
      }
      if(action==="toggle"||action==="pause"){
        const key=action==="pause"?"autonomous.paused":String(body.key||"");
        if(!["autonomous.paused","production.autonomous_enabled","publication.autonomous_enabled"].includes(key))throw Object.assign(new Error("invalid operation setting"),{status:400});
        const value=String(action==="pause"?body.value:body.value);
        if(!["true","false"].includes(value))throw Object.assign(new Error("switch must be true or false"),{status:400});
        setting(db,key,value);audit(db,actor,"autonomy-toggle","settings",key,value==="true"?"owner paused/enabled":"owner resumed/disabled");
        return json(res,200,{message:"Control setting saved. Scheduler action is reflected only when Stage 06 reports it."});
      }
      if(action==="topic"){
        const title=String(body.title||"").trim().slice(0,180),place=String(body.place||"").trim().slice(0,160),practice=String(body.practice||"").trim().slice(0,200);
        if(!title||!place||!practice)throw Object.assign(new Error("title, place and practice are required"),{status:400});
        const personaId=String(body.persona_id||"").trim()||null;
        if(personaId&&!db.prepare("SELECT id FROM personas WHERE id=? AND active=1").get(personaId))throw Object.assign(new Error("assignment requires an active persona"),{status:400});
        const slotDate=String(body.slot_date||"").trim()||null;
        if(slotDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(slotDate)||!db.prepare("SELECT id FROM publication_slots WHERE slot_date=?").get(slotDate)))throw Object.assign(new Error("assignment date must match an existing calendar slot"),{status:400});
        const id="owner-pitch-"+crypto.randomUUID(),at=NOW();
        db.prepare("INSERT INTO pitches(id,title,persona_id,place,practice,status,reason,created_at) VALUES(?,?,?,?,?,'new',?,?)").run(id,title,personaId,place,practice,String(body.reason||"Owner topic input").slice(0,1000),at);
        if(personaId||slotDate)db.prepare("INSERT INTO assignments(id,pitch_id,persona_id,slot_date,reason,created_at) VALUES(?,?,?,?,?,?)").run(crypto.randomUUID(),id,personaId,slotDate,"manual owner assignment",at);
        audit(db,actor,"topic-added","pitch",id,"manual topic input");return json(res,201,{message:"Topic recorded in the research queue for the scheduler; no run has started.",id});
      }
      if(action==="exclude"){
        const value=String(body.value||"").trim().slice(0,200);if(!value)throw Object.assign(new Error("topic/place required"),{status:400});
        const s=settingsGetAll(db),items=JSON.parse(s["topic.exclusions"]||"[]");if(!items.includes(value))items.push(value);setting(db,"topic.exclusions",JSON.stringify(items));audit(db,actor,"topic-excluded","topic",value,"owner exclusion");return json(res,200,{message:"Exclusion saved."});
      }
      if(action==="persona"){
        const persona=db.prepare("SELECT * FROM personas WHERE id=?").get(body.persona_id);if(!persona)throw Object.assign(new Error("persona not found"),{status:404});
        const brief=typeof body.brief_json==="string"?JSON.parse(body.brief_json):body.brief_json;if(!brief||typeof brief!=="object"||Array.isArray(brief))throw Object.assign(new Error("brief JSON object required"),{status:400});
        const latest=db.prepare("SELECT COALESCE(MAX(version),0) n FROM persona_briefs WHERE persona_id=?").get(persona.id).n;
        const active=body.active===true||body.active==="true"?1:0;
        db.prepare("UPDATE personas SET active=? WHERE id=?").run(active,persona.id);
        db.prepare("INSERT INTO persona_briefs(persona_id,version,brief_json,created_at) VALUES(?,?,?,?)").run(persona.id,latest+1,JSON.stringify(brief),NOW());
        audit(db,actor,"persona-brief-update","persona",persona.id,"new brief version "+(latest+1)+"; active="+active);
        return json(res,200,{message:"Persona settings and brief history saved."});
      }
      if(action==="retry"){
        const id=String(body.id||body.job_id||""),job=db.prepare("SELECT * FROM jobs WHERE id=?").get(id);
        if(!job)throw Object.assign(new Error("job not found"),{status:404});
        if(!["failed","retryable-failure"].includes(job.status))throw Object.assign(new Error("only failed jobs can be retried"),{status:409});
        let failedStep;
        if(body.step_name)failedStep=db.prepare("SELECT * FROM job_steps WHERE job_id=? AND step_name=? AND status='failed' ORDER BY id DESC LIMIT 1").get(id,String(body.step_name));
        else failedStep=db.prepare("SELECT * FROM job_steps WHERE job_id=? AND status='failed' ORDER BY id DESC LIMIT 1").get(id);
        if(body.step_name&&!failedStep)throw Object.assign(new Error("failed step not found"),{status:404});
        if(failedStep)db.prepare("INSERT INTO job_steps(job_id,step_name,status,attempt,detail,at) VALUES(?,?,'pending',?,?,?)").run(id,failedStep.step_name,failedStep.attempt+1,"owner retry requested; prior failed step id "+failedStep.id,NOW());
        db.prepare("UPDATE jobs SET status='pending',attempt=attempt+1,next_run_at=?,error=NULL WHERE id=?").run(NOW(),id);
        audit(db,actor,"retry-job-step","job",id,"owner retry request"+(failedStep?"; step "+failedStep.step_name:""));
        return json(res,202,{message:failedStep?"Retry queued for failed step "+failedStep.step_name+".":"Retry queued for the failed job."});
      }
      if(action==="replace"){
        const id=String(body.article_id||"");const article=db.prepare("SELECT * FROM articles WHERE id=? AND pipeline_state='ready'").get(id);
        if(!article)throw Object.assign(new Error("replacement must be a ready article"),{status:409});
        const tomorrow=new Date(localDate("America/Los_Angeles")+"T12:00:00Z");tomorrow.setUTCDate(tomorrow.getUTCDate()+1);const date=tomorrow.toISOString().slice(0,10);
        const slot=db.prepare("SELECT * FROM publication_slots WHERE slot_date=?").get(date);if(!slot||slot.status==="published")throw Object.assign(new Error("tomorrow's calendar slot is unavailable"),{status:409});
        const version=db.prepare("SELECT id FROM article_versions WHERE article_id=? ORDER BY version DESC LIMIT 1").get(id);
        db.prepare("UPDATE publication_slots SET article_version_id=?,status='assigned',note=? WHERE id=?").run(version?.id||null,"owner replacement for tomorrow",slot.id);
        db.prepare("INSERT INTO assignments(id,article_id,slot_date,reason,created_at) VALUES(?,?,?,?,?)").run(crypto.randomUUID(),id,date,"owner replaced the story for tomorrow",NOW());
        audit(db,actor,"replace-tomorrow","article",id,"slot "+date);return json(res,200,{message:"Tomorrow's slot now points to the selected ready article.",date});
      }
      if(action==="edit"||action==="correction"||action==="restore"){
        const id=String(body.article_id||body.id||"");let input=body,note=String(body.reason||body.note||"owner factual edit").slice(0,1000);
        if(action==="correction"){if(!note.trim())throw Object.assign(new Error("correction note required"),{status:400});const latest=db.prepare("SELECT * FROM article_versions WHERE article_id=? ORDER BY version DESC LIMIT 1").get(id);if(!latest)throw Object.assign(new Error("article version not found"),{status:404});input=JSON.parse(latest.content_json);note="correction: "+note;}
        if(action==="restore"){const chosen=db.prepare("SELECT * FROM article_versions WHERE article_id=? AND version=?").get(id,Number(body.version));if(!chosen)throw Object.assign(new Error("version not found"),{status:404});input=JSON.parse(chosen.content_json);note="restored version "+chosen.version+"; revalidation required";}
        const saved=articleVersionSave(db,id,input,actor,note);return json(res,200,{message:"Version "+saved.version+" saved; factual checks are invalidated and revalidation is required.",version:saved.version});
      }
      if(action==="unpublish"){
        const id=String(body.id||body.article_id||"");const art=db.prepare("SELECT * FROM articles WHERE id=?").get(id);if(!art)throw Object.assign(new Error("article not found"),{status:404});
        db.prepare("UPDATE articles SET status='draft',pipeline_state='needs-review',hold_reason='unpublished by owner',updated_at=? WHERE id=?").run(NOW(),id);
        db.prepare("UPDATE publication_slots SET status='open',article_version_id=NULL,note=? WHERE article_version_id IN (SELECT id FROM article_versions WHERE article_id=?) AND status='published'").run("unpublished by owner",id);
        audit(db,actor,"unpublish","article",id,"owner unpublish");return json(res,200,{message:"Article unpublished and placed in needs-review."});
      }
      if(action==="publish"){
        const id=String(body.id||body.article_id||"");
        if(body.intent!=="Publish this article immediately")throw Object.assign(new Error("explicit publish intent is required"),{status:400});
        const art=db.prepare("SELECT * FROM articles WHERE id=? AND pipeline_state='ready'").get(id);
        if(!art)throw Object.assign(new Error("only a ready article can be published"),{status:409});
        audit(db,actor,"publish-now-intent","article",id,"explicit owner request");
        const s=settingsGetAll(db);
        if(s["publication.publisher_ready"]==="true")throw Object.assign(new Error("publisher execution belongs to Stage 06 and is unavailable here"),{status:503});
        const jobId="owner-publish-now:"+crypto.randomUUID(),at=NOW();
        db.prepare("INSERT INTO jobs(id,job_type,status,next_run_at) VALUES(?,?,'pending',?)").run(jobId,"owner-publish-now",at);
        db.prepare("INSERT INTO job_steps(job_id,step_name,status,attempt,detail,at) VALUES(?,?,'pending',1,?,?)").run(jobId,"publish-now",JSON.stringify({article_id:id,actor,intent:"Publish this article immediately"}),at);
        audit(db,actor,"publish-now-queued","article",id,"recorded; no publisher is active yet");
        return json(res,202,{message:"Owner publish request recorded. Nothing was published; it awaits the Stage 06 publisher.",job_id:jobId});
      }
      return json(res,404,{error:"unknown action"});
    } catch(e){return json(res,e.status||400,{error:e.message||"request failed"});}
  }).catch(e=>json(res,e.status||400,{error:e.message==="Unexpected end of JSON input"?"invalid JSON":e.message}));
}
function handleAdminRequest(req,res,db,url) {
  const p=url.pathname;
  if(p!=="/admin"&&!p.startsWith("/admin/")&&!p.startsWith("/api/admin"))return false;
  if(p==="/admin"||p==="/admin/"){
    const auth=authorizeOwner(req);if(!auth.ok){if(auth.status===401)return html(res,401,"<!doctype html><title>Folkly sign in</title><h1>Sign in to continue</h1><p>"+esc(auth.error)+"</p><a href=\"/signin-with-chatgpt?return_to=%2Fadmin\" target=\"_top\">Sign in with ChatGPT</a>");return html(res,auth.status,"<!doctype html><title>Folkly</title><h1>Owner access required</h1><p>"+esc(auth.error)+"</p>");}
    if(req.method!=="GET")return html(res,405,"<!doctype html><title>Method not allowed</title><h1>Method not allowed</h1>");
    return html(res,200,page(db,url.searchParams));
  }
  if(p.startsWith("/api/admin"))return api(db,req,res,p);
  return html(res,404,"<!doctype html><title>Not found</title><h1>Not found</h1>");
}
module.exports={handleAdminRequest,dashboard,articleRecord,articleVersionSave,checkOrigin,sanitizeArticleHtml};
