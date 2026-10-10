const el = id => document.getElementById(id);
const status = el('owner-status');
const ownerRequestFetch=(...args)=>typeof window!=='undefined'&&window.ownerFetch?window.ownerFetch(...args):fetch(...args);
let sessionGeneration=0, nextContactCursor=null, nextSubscriberCursor=null;
function signedIn(value) {
  if(!value){sessionGeneration++;nextContactCursor=null;nextSubscriberCursor=null;el('owner-contact-next').disabled=true;el('owner-subscriber-next').disabled=true;}
  typeof document.dispatchEvent==='function'&&document.dispatchEvent(new CustomEvent('owner-session',{detail:{signedIn:value,generation:sessionGeneration}}));
  el('owner-login').hidden=value; el('owner-dashboard').hidden=!value; el('owner-logout').hidden=!value;
  if (!value) for(const id of ['owner-articles','owner-jobs','owner-reservations','owner-budget','owner-switches','owner-updated','owner-migration','owner-contacts','owner-contact-note','owner-subscriber-list','owner-subscriber-note']) el(id).replaceChildren();
}
function expireOwnerSession() {
  signedIn(false);
  el('owner-code').value='';
  status.textContent='Your owner session expired or is no longer active. Request a new sign-in code to continue.';
}
function table(id,section,columns,empty) {
  const target=el(id);target.replaceChildren();
  if(!section?.available){target.textContent='Status unavailable. Refresh to try again.';return;}
  if(!section.rows.length){target.textContent=empty;return;}
  const table=document.createElement('table'),head=document.createElement('thead'),header=document.createElement('tr'),body=document.createElement('tbody');
  for(const [,label] of columns){const cell=document.createElement('th');cell.scope='col';cell.textContent=label;header.append(cell);}head.append(header);
  for(const row of section.rows){const tr=document.createElement('tr');for(const [key,,render] of columns){const cell=document.createElement('td');if(render)cell.append(render(row));else cell.textContent=String(row[key]??'—');tr.append(cell);}body.append(tr);}
  table.append(head,body);target.append(table);
}
function render(data) {
  signedIn(true);const d=data.dashboard,s=d.sections;
  el('owner-switches').replaceChildren();
  for(const [key,label] of [['production.autonomous_enabled','AI generation'],['publication.autonomous_enabled','Automatic publication'],['schedule.enabled','Article schedule']]){const li=document.createElement('li');li.textContent=`${label}: ${data.settings[key]==='true'?'On':data.settings[key]==='false'?'Off':'Unknown'}`;el('owner-switches').append(li);}
  el('owner-budget').textContent=s.budget.available&&s.budget.rows[0]?`Daily cap: $${Number(s.budget.rows[0].daily_usd).toFixed(2)} · Per-attempt cap: $${Number(s.budget.rows[0].job_usd).toFixed(2)}`:'Budget status unavailable.';
  el('owner-migration').textContent=d.migration.message;
  el('owner-updated').textContent=`Updated ${new Date(d.generatedAt).toLocaleString()}`;
  typeof document.dispatchEvent==='function'&&document.dispatchEvent(new CustomEvent('owner-drafts',{detail:s.articles}));
  table('owner-articles',s.articles,[['title','Title'],['status','Status'],['pipeline_state','Editorial stage'],['updated_at','Updated']],'No editorial records have been migrated yet. Existing public stories remain in the archive.');
  table('owner-jobs',s.jobs,[['job_type','Type'],['status','Status'],['attempt','Attempts'],['last_run_at','Last run']],'No jobs recorded.');
  renderContacts(s.contacts);
  loadSubscribers();
  table('owner-reservations',s.reservations,[['model','Model'],['reserved_usd','Reserved USD'],['state','Outcome'],['budget_date','Budget date']],'No model reservations recorded.');
}
function renderSubscribers(section) {
  table('owner-subscriber-list',section,[['email','Email'],['status','Status'],['subscribedAt','Subscribed'],['consentVersion','Consent version'],['source','Source']],'No subscriber records saved.');
  nextSubscriberCursor=section?.available?section.nextCursor:null;
  el('owner-subscriber-next').disabled=!nextSubscriberCursor;
  el('owner-subscriber-note').textContent=section?.available?(section.hasMore?'Showing one private page in storage order. Use Next page to see more.':'End of subscriber records. Delivery remains paused until hosted acceptance passes.'):'Subscriber records unavailable. No delivery state has been changed.';
}
async function loadSubscribers(cursor) {
  const generation=sessionGeneration;
  el('owner-subscriber-next').disabled=true;el('owner-subscriber-first').disabled=true;
  try {
    const query=cursor?'&cursor='+encodeURIComponent(cursor):'';
    const response=await ownerRequestFetch('/api/owner?view=subscribers'+query,{cache:'no-store'});
    const data=await response.json();
    if(generation!==sessionGeneration||el('owner-dashboard').hidden)return;
    if(response.status===401){expireOwnerSession();return;}
    if(!response.ok||!data.owner||!data.subscribers?.available)throw Error();
    renderSubscribers(data.subscribers);
  }catch {
    if(generation===sessionGeneration&&!el('owner-dashboard').hidden){renderSubscribers({available:false});status.textContent='Subscriber records unavailable. Return to the first page to retry.';}
  }finally{el('owner-subscriber-first').disabled=false;}
}
function renderContacts(section) {
  table('owner-contacts',section,[['name','Name'],['email','Email'],['reason','Reason'],['contributor','Contributor interest'],['message','Message'],['receivedAt','Received'],['reply','Reply',row=>{const link=document.createElement('a');link.textContent='Reply';link.href=`mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent('Re: Your message to Folkly')}&body=${encodeURIComponent(`Hi ${row.name},\n\n`)}`;link.rel='nofollow';return link;}]],'No contact messages saved.');
  nextContactCursor=section?.available?section.nextCursor:null;
  el('owner-contact-next').disabled=!nextContactCursor;
  el('owner-contact-note').textContent=section?.hasMore?'Showing one page in storage order. Use Reply to open your email app, or Next page to see more.':'End of stored messages. Reply opens your email app and does not send automatically.';
}
async function loadContacts(cursor) {
  const generation=sessionGeneration;
  el('owner-contact-next').disabled=true;el('owner-contact-first').disabled=true;
  try {
    const query=cursor?'&cursor='+encodeURIComponent(cursor):'';
    const response=await ownerRequestFetch('/api/owner?view=contacts'+query,{cache:'no-store'});
    const data=await response.json();
    if(generation!==sessionGeneration||el('owner-dashboard').hidden)return;
    if(response.status===401){expireOwnerSession();return;}
    if(!response.ok||!data.owner||!data.contacts?.available)throw Error();
    renderContacts(data.contacts);
  }catch {
    if(generation===sessionGeneration&&!el('owner-dashboard').hidden){renderContacts({available:false});status.textContent='Inbox unavailable. Return to the first page to retry.';}
  }finally{el('owner-contact-first').disabled=false;}
}
el('owner-contact-next').addEventListener('click',()=>{if(nextContactCursor)loadContacts(nextContactCursor);});
el('owner-contact-first').addEventListener('click',()=>loadContacts());
el('owner-subscriber-next').addEventListener('click',()=>{if(nextSubscriberCursor)loadSubscribers(nextSubscriberCursor);});
el('owner-subscriber-first').addEventListener('click',()=>loadSubscribers());
async function loadStatus() {
  const generation=sessionGeneration, wasSignedIn=!el('owner-dashboard').hidden;
  const response=await ownerRequestFetch('/api/owner',{cache:'no-store'});const data=await response.json();
  if(generation!==sessionGeneration)return false;
  if(response.ok&&data.owner&&data.dashboard){render(data);return true;}
  if(response.status===401&&wasSignedIn)expireOwnerSession();
  else {signedIn(false);if(response.status!==401)status.textContent=data.message||'Dashboard unavailable.';}
  return false;
}
async function send(body) {
  const response=await ownerRequestFetch('/api/owner',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json();status.textContent=data.message;
  if(body.action==='logout')signedIn(false);
  else if(response.ok&&body.action==='verify')await loadStatus();
}
el('owner-form').addEventListener('submit',async event=>{
 event.preventDefault();const action=event.submitter?.value||'login',code=el('owner-code').value.trim();
 if(action==='verify'&&!/^\d{6,10}$/.test(code)){status.textContent='Enter the sign-in code from your email first.';el('owner-code').focus();return;}
 const buttons=[...event.currentTarget.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
 try{await send({action,email:el('owner-email').value,code,remember:el('owner-remember').checked});if(action==='verify')el('owner-code').value='';}catch{status.textContent='Connection unavailable. Please try again.';}finally{buttons.forEach(b=>b.disabled=false);}
});
el('owner-logout').addEventListener('click',async()=>{signedIn(false);try{await send({action:'logout'});}catch{signedIn(false);status.textContent='Sign-out could not be confirmed. Close this page and retry sign-out.';}});
el('owner-refresh').addEventListener('click',async()=>{try{if(await loadStatus())status.textContent='Dashboard refreshed.';}catch{signedIn(false);status.textContent='Session status unavailable. Refresh to try again.';}});
loadStatus().catch(()=>{signedIn(false);status.textContent='Connection unavailable.';});

setInterval(()=>{if(!el('owner-dashboard').hidden)loadStatus().catch(()=>{signedIn(false);status.textContent='Session status unavailable. Refresh to try again.';});},60000);
