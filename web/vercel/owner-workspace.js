(()=>{
 const el=id=>document.getElementById(id);let active=false,generation=0,loaded=false;const ideaRows=new Map();
 const clear=()=>{ideaRows.clear();for(const id of ['ideas-body','editor-history','draft-preview','draft-buttons'])el(id).replaceChildren();el('editor-message').value='';el('editor-status').textContent='';el('ideas-status').textContent='';loaded=false;};
 document.addEventListener('owner-session',event=>{active=event.detail.signedIn;if(!active){generation++;clear();}else if(!loaded){loaded=true;load();}});
 async function request(url,body){const g=generation;const response=await fetch(url,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const data=await response.json();if(g!==generation||!active)throw Error('SESSION_CHANGED');if(response.status===401){active=false;generation++;clear();if(typeof window.expireOwnerSession==='function')window.expireOwnerSession();else if(typeof window.signedIn==='function')window.signedIn(false);throw Error('Sign in again.');}if(!response.ok)throw Error(data.message||'Workspace unavailable.');return data;}
 function ideaRow(idea){
  const row=document.createElement('tr'),fields={};
  for(const key of ['title','place','angle','sources','notes','priority','status']){
   const cell=document.createElement('td'),input=document.createElement(['priority','status'].includes(key)?'select':['angle','sources','notes'].includes(key)?'textarea':'input');
   input.setAttribute('aria-label',`${key} for article idea`);input.maxLength=2000;
   if(input.tagName==='SELECT')for(const value of key==='priority'?['Normal','High','Low']:['Idea','Research','Drafting','Hold']){const option=document.createElement('option');option.value=value;option.textContent=value;input.append(option);}
   input.value=idea[key]||(['priority','status'].includes(key)?key==='priority'?'Normal':'Idea':'');fields[key]=input;cell.append(input);row.append(cell);
  }
  const cell=document.createElement('td'),save=document.createElement('button'),note=document.createElement('p');save.type='button';save.textContent='Save';note.setAttribute('role','status');cell.append(save,note);row.append(cell);let etag=idea.etag;
  const values=()=>Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.value]));let saved=etag?JSON.stringify(values()):null;
  const state={row,dirty:()=>saved!==JSON.stringify(values())};ideaRows.set(idea.id,state);
  for(const field of Object.values(fields))field.addEventListener('input',()=>{note.textContent=state.dirty()?'Unsaved changes.':'Saved.';});
  save.addEventListener('click',async()=>{
   const current=values();if(!current.title.trim()){note.textContent='Enter a title before saving.';fields.title.focus();return;}
   save.disabled=true;for(const field of Object.values(fields))field.disabled=true;note.textContent='Saving and verifying…';
   try{const result=await request('/api/owner-workspace',{action:'idea',etag,idea:{id:idea.id,...current}});if(!result.idea?.etag)throw Error('Save could not be verified. Keep your text and refresh before retrying.');etag=result.idea.etag;state.expectedEtag=etag;saved=JSON.stringify(current);note.textContent='Saved and verified.';el('ideas-status').textContent='Idea saved privately and read back successfully.';}
   catch(error){if(active&&error.message!=='SESSION_CHANGED'){note.textContent=error.message;el('ideas-status').textContent=error.message;}}
   finally{save.disabled=false;for(const field of Object.values(fields))field.disabled=false;}
  });
  el('ideas-body').append(row);
 }
 async function load(){try{
  const data=await request('/api/owner-workspace');
  if(data.ideasAvailable!==false){
   for(const idea of data.ideas){const state=ideaRows.get(idea.id);if(state?.expectedEtag===idea.etag)state.expectedEtag=null;}
   const dirty=new Map([...ideaRows].filter(([,state])=>state.dirty()||state.expectedEtag));ideaRows.clear();el('ideas-body').replaceChildren();
   for(const [id,state] of dirty){ideaRows.set(id,state);el('ideas-body').append(state.row);}
   for(const idea of data.ideas)if(!dirty.has(idea.id))ideaRow(idea);
   const unsaved=[...dirty.values()].filter(state=>state.dirty()).length;
   el('ideas-status').textContent=unsaved?`Retained ${unsaved} unsaved idea row(s). Save each row explicitly.`:dirty.size?'Verified saves are retained while the storage list catches up.':'';
  }else el('ideas-status').textContent=data.ideasMessage||'Idea storage unavailable. Your unsaved text is retained.';
  if(data.chatHistoryAvailable!==false){el('editor-history').replaceChildren();for(const turn of data.chat.slice().reverse()){const p=document.createElement('p');p.textContent=`You: ${turn.message}\nEditor: ${turn.response||'Reply pending or unavailable; retained for recovery.'}`;el('editor-history').append(p);}}
  el('editor-form').querySelector('button').disabled=!data.chatAvailable;
  el('editor-status').textContent=data.chatMessage||(data.chatAvailable?'Ready.':'Chat needs funded OpenAI access and editor-chat configuration.');
 }catch(error){if(active&&error.message!=='SESSION_CHANGED'){el('ideas-status').textContent=error.message;el('editor-status').textContent=error.message;}}}
 el('idea-add').addEventListener('click',()=>{if(active)ideaRow({id:crypto.randomUUID()});});el('workspace-refresh').addEventListener('click',load);
 el('editor-form').addEventListener('submit',async event=>{event.preventDefault();if(!active)return;const button=event.currentTarget.querySelector('button');button.disabled=true;el('editor-status').textContent='Editor is responding. This can take up to 30 seconds.';try{const message=el('editor-message').value;await request('/api/owner-workspace',{action:'chat',id:crypto.randomUUID(),message});el('editor-message').value='';await load();}catch(error){if(active&&error.message!=='SESSION_CHANGED')el('editor-status').textContent=error.message;}finally{button.disabled=false;}});
 document.addEventListener('owner-drafts',event=>{if(!active)return;el('draft-buttons').replaceChildren();for(const draft of event.detail?.rows||[]){const button=document.createElement('button');button.type='button';button.textContent=`View: ${draft.title}`;button.addEventListener('click',async()=>{try{const {draft:version}=await request('/api/owner-workspace?draft='+encodeURIComponent(draft.id));el('draft-preview').replaceChildren();const h=document.createElement('h3');h.textContent=`${version.title} · version ${version.version}`;const text=document.createElement('div');let content=version.content;try{const value=JSON.parse(content);content=value.sections?value.sections.map(s=>`${s.heading}\n\n${s.text}`).join('\n\n'):value.bodyText||value.body|| (value.body_html?value.body_html.replace(/<\/(?:p|h[1-6]|li|blockquote)>/gi,'\n\n').replace(/<[^>]*>/g,'').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,e=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '})[e]):JSON.stringify(value,null,2));}catch{}text.textContent=typeof content==='string'?content:JSON.stringify(content,null,2);el('draft-preview').append(h,text);el('draft-preview').scrollIntoView({block:'start'});}catch(error){if(error.message!=='SESSION_CHANGED')el('draft-preview').textContent=error.message;}});el('draft-buttons').append(button);}});
})();
