"use strict";
const assert=require("node:assert/strict");
const http=require("node:http");
const {openDb}=require("../lib/db");
const {scorePitch}=require("../lib/calendar");
const {authorizeOwner,authorizeJob}=require("../lib/admin-auth");
const {handleAdminRequest,sanitizeArticleHtml}=require("../lib/admin");

process.env.FOLKLY_TRUSTED_AUTH_PROXY="sites";
process.env.FOLKLY_OWNER_USER_ID="owner-test-id";
process.env.FOLKLY_JOB_TOKEN="distinct-job-token";
process.env.FOLKLY_JOB_SCOPES="publication:read";
const db=openDb(":memory:");
const at=new Date().toISOString();
db.prepare("INSERT INTO articles(id,slug,title,status,pipeline_state,content_hash,created_at,updated_at) VALUES('a1','story','Story','draft','draft','hash',?,?)").run(at,at);
db.prepare("INSERT INTO article_versions(id,article_id,version,content_json,created_by,created_at) VALUES('a1-v1','a1',1,?,'seed',?)").run(JSON.stringify({_admin_title:"Story",deck:"Deck",body_html:"<p>Original</p>",sources:[],figure:{src:"/assets/test.jpg"}}),at);
db.prepare("INSERT INTO sources(id,article_version_id,ord,title,url,excerpt) VALUES('src1','a1-v1',1,'Evidence page','https://example.org/source','supporting excerpt')").run();
db.prepare("INSERT INTO claim_citations(id,article_version_id,claim,source_ids,verified) VALUES('claim1','a1-v1','Supported detail','[\"src1\"]',1)").run();
db.prepare("INSERT INTO media_assets(id,file_path,creator,license,license_url,attribution) VALUES('image1','/assets/test.jpg','Local artist','CC BY 4.0','https://creativecommons.org/licenses/by/4.0/','Local artist, CC BY 4.0')").run();
db.prepare("INSERT INTO personas(id,name,slug,bio_public,active,subject_tags,created_at) VALUES('p1','Persona One','persona-one','Bio',1,'[]',?)").run(at);
db.prepare("INSERT INTO persona_briefs(persona_id,version,brief_json,created_at) VALUES('p1',1,'{}',?)").run(at);
db.prepare("INSERT INTO jobs(id,job_type,status,error) VALUES('j1','research','failed','temporary')").run();
db.prepare("INSERT INTO job_steps(job_id,step_name,status,attempt,detail,at) VALUES('j1','source-research','failed',1,'source timeout',?)").run(at);
db.prepare("INSERT INTO articles(id,slug,title,status,pipeline_state,content_hash,created_at,updated_at) VALUES('ready1','ready-story','Ready story','draft','ready','hash',?,?)").run(at,at);
db.prepare("INSERT INTO article_versions(id,article_id,version,content_json,created_by,created_at) VALUES('ready1-v1','ready1',1,'{}','seed',?)").run(at);
const todayParts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const todayObj=Object.fromEntries(todayParts.map(x=>[x.type,x.value]));const tomorrowDate=new Date(todayObj.year+"-"+todayObj.month+"-"+todayObj.day+"T12:00:00Z");tomorrowDate.setUTCDate(tomorrowDate.getUTCDate()+1);const tomorrow=tomorrowDate.toISOString().slice(0,10);
db.prepare("INSERT INTO publication_slots(id,slot_date,status) VALUES(?,?,'open')").run("tomorrow",tomorrow);

async function call(method,path,userId,body,origin="http://localhost"){
  const headers={host:"localhost",origin,"content-type":"application/json"};
  if(userId)headers["oai-authenticated-user-id"]=userId;
  const req={method,url:path,headers,async *[Symbol.asyncIterator](){if(body)yield Buffer.from(JSON.stringify(body));}};
  const res={status:0,headers:{},body:"",writeHead(code,h){this.status=code;this.headers=h;},end(v){this.body=String(v||"");}};
  handleAdminRequest(req,res,db,new URL(path,"http://localhost"));
  await new Promise(r=>setImmediate(r));
  let parsed;try{parsed=JSON.parse(res.body);}catch{}
  return {status:res.status,body:parsed||res.body};
}
(async()=>{
  assert.equal(authorizeOwner({headers:{}},{FOLKLY_TRUSTED_AUTH_PROXY:"sites",FOLKLY_OWNER_USER_ID:"owner"}).status,401);
  assert.equal(authorizeOwner({headers:{"oai-authenticated-user-id":"visitor"}},{FOLKLY_TRUSTED_AUTH_PROXY:"sites",FOLKLY_OWNER_USER_ID:"owner"}).status,403);
  assert.equal(authorizeOwner({headers:{"oai-authenticated-user-id":"owner"}},{FOLKLY_TRUSTED_AUTH_PROXY:"sites",FOLKLY_OWNER_USER_ID:"owner"}).ok,true);
  assert.equal(authorizeOwner({headers:{"oai-authenticated-user-id":"owner"}},{FOLKLY_OWNER_USER_ID:"owner"}).status,503);
  assert.equal(authorizeJob({headers:{authorization:"Bearer distinct-job-token"}},"publication:read").ok,true);
  assert.equal(authorizeJob({headers:{"oai-authenticated-user-id":"owner"}},"publication:read").ok,false);

  for(const url of ["/admin","/api/admin/dashboard","/api/admin/article?id=a1"]){
    const anon=await call("GET",url,null);assert.equal(anon.status,401,"anonymous private read: "+url);if(url==="/admin")assert.match(anon.body,/Sign in with ChatGPT/);
    assert.equal((await call("GET",url,"visitor")).status,403,"non-owner private read: "+url);
  }
  for(const [action,payload] of [
    ["edit",{article_id:"a1",title:"Changed",deck:"deck",body_html:"<p>Changed</p>",reason:"correction"}],
    ["unpublish",{id:"a1"}],
    ["settings",{settings:{"budget.daily_usd":"6"}}],
    ["publish",{id:"ready1",intent:"Publish this article immediately"}],
  ]){
    assert.equal((await call("POST","/api/admin/"+action,null,payload)).status,401,"anonymous action: "+action);
    assert.equal((await call("POST","/api/admin/"+action,"visitor",payload)).status,403,"non-owner action: "+action);
  }
  assert.equal((await call("GET","/admin","owner-test-id")).status,200);
  const dashBefore=await call("GET","/api/admin/dashboard","owner-test-id");
  assert.equal(dashBefore.status,200);
  assert.match(dashBefore.body.automations.production.state,/unavailable/);
  assert.equal(dashBefore.body.reserve.ready,1);
  assert.match(dashBefore.body.nextPublication.label,/7:00 AM/);

  assert.equal((await call("POST","/api/admin/settings","owner-test-id",{settings:{"budget.daily_usd":"6","article.length_min":"300","article.length_typical_min":"150","article.length_typical_max":"1800","article.length_max":"2200"}})).status,400);
  assert.equal(db.prepare("SELECT value FROM settings WHERE key='budget.daily_usd'").get().value,"5");
  assert.equal((await call("POST","/api/admin/settings","owner-test-id",{settings:{"budget.daily_usd":"6"}},"https://attacker.example")).status,403);
  assert.equal((await call("POST","/api/admin/settings","owner-test-id",{settings:{"budget.daily_usd":"6","provider.llm.model":"test-model","editorial.policy_json":"{}"}})).status,200);
  assert.equal(db.prepare("SELECT value FROM settings WHERE key='budget.daily_usd'").get().value,"6");
  assert.equal(require("../lib/provider").providerConfig(db).model,"test-model");
  assert.equal((await call("POST","/api/admin/settings","owner-test-id",{settings:{"site.timezone":"UTC"}})).status,400);
  assert.equal((await call("POST","/api/admin/topic","owner-test-id",{title:"Harbor songs",place:"Portland, Maine",practice:"Dockside singing",persona_id:"p1",slot_date:tomorrow,reason:"Owner topic"})).status,201);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM assignments WHERE slot_date=?").get(tomorrow).n,1);
  assert.equal((await call("POST","/api/admin/exclude","owner-test-id",{value:"Portland"})).status,200);
  assert.ok(scorePitch(db,{title:"Portland harbor songs",place:"Portland, Maine",practice:"Dockside singing"}).reasons[0].startsWith("excluded by owner"));
  assert.equal((await call("POST","/api/admin/persona","owner-test-id",{persona_id:"p1",active:false,brief_json:{voice:"curious"}})).status,200);
  assert.equal(db.prepare("SELECT active FROM personas WHERE id='p1'").get().active,0);
  assert.equal(db.prepare("SELECT MAX(version) version FROM persona_briefs WHERE persona_id='p1'").get().version,2);

  const hostile='<p onclick="alert(1)">Changed fact<script>alert(1)</script><a href="javascript:alert(1)">link</a><img src=x onerror=alert(1)></p>';
  assert.equal((await call("POST","/api/admin/edit","owner-test-id",{article_id:"a1",title:"Edited story",body_html:hostile,reason:"owner edit"})).status,200);
  assert.equal(db.prepare("SELECT pipeline_state FROM articles WHERE id='a1'").get().pipeline_state,"verification");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM article_versions WHERE article_id='a1'").get().n,2);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM jobs WHERE job_type='revalidate-article' AND status='pending'").get().n,1);
  const edited=JSON.parse(db.prepare("SELECT content_json FROM article_versions WHERE article_id='a1' ORDER BY version DESC LIMIT 1").get().content_json);
  for(const bad of ["<script","onclick","javascript:","onerror"])assert.equal(edited.body_html.includes(bad),false,"sanitizes "+bad);
  const newSource=db.prepare("SELECT id FROM sources WHERE article_version_id='a1-v2'").get();assert.ok(newSource);
  const newClaim=JSON.parse(db.prepare("SELECT source_ids FROM claim_citations WHERE article_version_id='a1-v2'").get().source_ids);assert.deepEqual(newClaim,[newSource.id]);
  const detail=await call("GET","/api/admin/article?id=a1","owner-test-id");assert.equal(detail.status,200);assert.equal(detail.body.sources.length,1);assert.equal(detail.body.imageAssets[0].attribution,"Local artist, CC BY 4.0");
  assert.equal((await call("POST","/api/admin/restore","owner-test-id",{id:"a1",version:1})).status,200);
  assert.equal(db.prepare("SELECT title FROM articles WHERE id='a1'").get().title,"Story");
  assert.equal((await call("POST","/api/admin/retry","owner-test-id",{id:"j1",step_name:"source-research"})).status,202);
  assert.equal(db.prepare("SELECT status FROM job_steps WHERE job_id='j1' ORDER BY id DESC LIMIT 1").get().status,"pending");
  assert.equal((await call("POST","/api/admin/replace","owner-test-id",{article_id:"ready1"})).status,200);
  assert.equal((await call("POST","/api/admin/publish","owner-test-id",{id:"ready1",intent:"Publish this article immediately"})).status,202);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM jobs WHERE job_type='owner-publish-now' AND status='pending'").get().n,1);
  const publishStep=JSON.parse(db.prepare("SELECT detail FROM job_steps WHERE step_name='publish-now' ORDER BY id DESC LIMIT 1").get().detail);assert.equal(publishStep.article_id,"ready1");
  assert.equal(db.prepare("SELECT status FROM articles WHERE id='ready1'").get().status,"draft");
  assert.equal((await call("POST","/api/admin/unpublish","owner-test-id",{id:"a1"})).status,200);
  assert.equal((await call("GET","/api/admin/compare?id=a1&a=1&b=3","owner-test-id")).status,200);
  assert.equal((await call("POST","/api/admin/pause","owner-test-id",{value:"true"})).status,200);
  assert.equal((await call("POST","/api/admin/pause","owner-test-id",{value:"false"})).status,200);
  assert.ok(db.prepare("SELECT COUNT(*) n FROM audit_events WHERE actor='owner-test-id'").get().n>=8);
  assert.equal(sanitizeArticleHtml("<p>safe</p><script>bad()</script>"),"<p>safe</p>");
  process.env.FOLKLY_DB=":memory:";
  const {server,db:serverDb}=require("../server");
  await new Promise(resolve=>server.listen(0,resolve));
  const port=server.address().port;
  const httpCall=(path,user,method="GET",body)=>new Promise((resolve,reject)=>{const headers={host:"127.0.0.1:"+port};if(user)headers["oai-authenticated-user-id"]=user;if(body){headers["content-type"]="application/json";headers.origin="http://127.0.0.1:"+port;}const request=http.request({host:"127.0.0.1",port,path,method,headers},response=>{let text="";response.setEncoding("utf8");response.on("data",chunk=>text+=chunk);response.on("end",()=>resolve({status:response.statusCode,text}));});request.on("error",reject);request.end(body?JSON.stringify(body):undefined);});
  assert.equal((await httpCall("/admin")).status,401);
  assert.equal((await httpCall("/admin","visitor")).status,403);
  assert.equal((await httpCall("/admin","owner-test-id")).status,200);
  assert.equal((await httpCall("/api/admin/dashboard","owner-test-id")).status,200);
  assert.equal((await httpCall("/api/admin/settings","owner-test-id","POST",{settings:{"budget.daily_usd":"7"}})).status,200);
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  serverDb.close();
  console.log("Stage 05 admin auth and control tests passed (RBAC, XSS, Pacific time, settings, versioning, overrides and server routes).");
  db.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
