import { readContactInbox } from './contact-inbox.js';
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
  sections.contacts=await readContacts();
  return { sections, publicationLocked:true, analytics:{state:'foundation'}, migration:{state:'pending',message:'The public reader serves four existing stories. The seven-story private reserve remains in the original Site until a verified migration is complete.'}, generatedAt:new Date().toISOString() };
}
