import { readContactInbox } from './contact-inbox.js';
async function importStatus(db){
 try{
  const result=await db.from('folkly_import_grants').select('receipt,completed_at').eq('status','verified').order('completed_at',{ascending:false}).limit(1);
  if(result.error)throw Error();
  if(!result.data?.length)return {state:'pending',message:'No verified original source-import receipt recorded. Published stories are served separately.'};
  const row=result.data[0],r=row.receipt;
  if(r?.format!=='folkly-import-readback-v1'||r.mode!=='blob'||r.backupVerified!==true||r.sweeps!==2||r.switchesPaused!==true||
   !Number.isSafeInteger(r.counts?.articles)||r.counts.articles<0||r.counts.articles>10000||!Number.isSafeInteger(r.verifiedVersions)||r.verifiedVersions<0||r.verifiedVersions>10000||
   r.verifiedVersions!==r.counts.article_versions||!Number.isFinite(Date.parse(row.completed_at)))throw Error();
  return {state:'verified',message:`Original source import verified: ${r.counts.articles} stories and ${r.verifiedVersions} saved versions. Open saved versions below; they may predate current public edits.`};
 }catch{return {state:'unavailable',message:'Source-import verification status unavailable. No publication state has changed.'};}
}
// Called only after identity, private membership and active-session validation.
export async function readOwnerDashboard(db, { readContacts=readContactInbox }={}) {
  const queries = {
    articles: () => db.from('folkly_articles').select('id,slug,title,status,pipeline_state,updated_at').order('updated_at',{ascending:false}).limit(25),
    jobs: () => db.from('folkly_jobs').select('id,job_type,status,attempt,last_run_at,next_run_at').order('last_run_at',{ascending:false,nullsFirst:false}).limit(20),
    budget: () => db.from('folkly_model_budget').select('daily_usd,job_usd').limit(1),
    reservations: () => db.from('folkly_model_reservations').select('job_id,model,reserved_usd,state,budget_date,created_at').order('created_at',{ascending:false}).limit(20),
  };
  const sections = Object.fromEntries(await Promise.all(Object.entries(queries).map(async ([key,query]) => {
    try { const result = await query(); if (result.error) throw Error(); return [key,{available:true,rows:result.data || []}]; }
    catch { return [key,{available:false,rows:[]}]; }
  })));
  const [contacts,migration]=await Promise.all([readContacts(),importStatus(db)]);sections.contacts=contacts;
  return { sections, publicationLocked:true, analytics:{state:'foundation'}, migration, generatedAt:new Date().toISOString() };
}
