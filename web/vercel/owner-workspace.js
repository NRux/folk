(()=>{
 const el=id=>document.getElementById(id);let active=false,generation=0,previewGeneration=0,loaded=false;const ideaRows=new Map();
 const clear=()=>{previewGeneration++;ideaRows.clear();for(const id of ['ideas-body','editor-history','draft-preview','draft-buttons'])el(id).replaceChildren();el('editor-message').value='';el('editor-status').textContent='';el('ideas-status').textContent='';loaded=false;};
 document.addEventListener('owner-session',event=>{active=event.detail.signedIn;if(!active){generation++;clear();}else if(!loaded){loaded=true;load();}});
 const faultCodes=new Set(['CONFLICT','SAVE_UNVERIFIED','EDITOR_NOT_CONFIGURED','BUDGET_EXHAUSTED','BUDGET_UNAVAILABLE','BLOB_ACCESS_DENIED','BLOB_STORE_NOT_FOUND','BLOB_STORE_SUSPENDED','BLOB_RATE_LIMITED','BLOB_UNAVAILABLE','MODEL_CREDENTIALS_REJECTED','MODEL_RATE_OR_QUOTA_LIMIT','MODEL_UNAVAILABLE','MODEL_REQUEST_REJECTED','MODEL_TIMEOUT','MODEL_EMPTY_REPLY','MODEL_OUTPUT_LIMIT','MODEL_CONTENT_FILTER','CHAT_HISTORY_UNAVAILABLE','WORKSPACE_STORAGE_UNAVAILABLE']);
 const faultStages=new Set(['configuration','attempt-save','budget','chat-history','provider','reply-read','reply-save','idea-save','request']);
 function diagnostic(data){return faultCodes.has(data?.code)&&faultStages.has(data?.stage)?' Diagnostic: '+data.code+' ('+data.stage+').':'';}
 async function request(url,body){const g=generation;const response=await fetch(url,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const data=await response.json();if(g!==generation||!active)throw Error('SESSION_CHANGED');if(response.status===401){active=false;generation++;clear();if(typeof window.expireOwnerSession==='function')window.expireOwnerSession();else if(typeof window.signedIn==='function')window.signedIn(false);throw Error('Sign in again.');}if(!response.ok)throw Error((data.message||'Workspace unavailable.')+diagnostic(data));return data;}
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
 function previewText(raw){
  const value=JSON.parse(raw);
  return value.sections?value.sections.map(s=>`${s.heading}\n\n${s.text}`).join('\n\n'):value.bodyText||value.body||(value.body_html?value.body_html.replace(/<\/(?:p|h[1-6]|li|blockquote)>/gi,'\n\n').replace(/<[^>]*>/g,'').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,e=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '})[e]):JSON.stringify(value,null,2));
 }
 async function openDraft(articleId,number,restoreFocus=false){
  if(!active)return;const current=++previewGeneration;
  el('draft-preview').replaceChildren();el('draft-preview').textContent='Loading and verifying saved content…';
  try{
   const {draft}=await request('/api/owner-workspace?draft='+encodeURIComponent(articleId)+(number===undefined?'':'&version='+encodeURIComponent(number)));
   if(current!==previewGeneration||!active)return;
   if(!draft||!Array.isArray(draft.versions)||!draft.versions.length||typeof draft.content!=='string')throw Error('Saved version response unavailable. Refresh before retrying.');
   const h=document.createElement('h3');h.textContent=`${draft.title} · version ${draft.version}`;
   const note=document.createElement('p');note.textContent=`Article status: ${draft.status}. Saved versions are private and may predate the public story.`;
   const label=document.createElement('label');label.setAttribute('for','draft-version-select');label.textContent='Saved version';
   const select=document.createElement('select');select.setAttribute('id','draft-version-select');select.setAttribute('aria-label','Saved version');
   for(const row of draft.versions){const option=document.createElement('option');option.value=String(row.version);option.textContent=`Version ${row.version} · ${new Date(row.createdAt).toLocaleString()}`;select.append(option);}
   select.value=String(draft.version);select.addEventListener('change',()=>openDraft(articleId,Number(select.value),true));
   const text=document.createElement('div'),content=previewText(draft.content);text.textContent=typeof content==='string'?content:JSON.stringify(content,null,2);
   el('draft-preview').replaceChildren(h,note,label,select,text);
   if(restoreFocus)select.focus();else el('draft-preview').scrollIntoView({block:'start'});
  }catch(error){if(current===previewGeneration&&active&&error.message!=='SESSION_CHANGED')el('draft-preview').textContent=error.message;}
 }
 document.addEventListener('owner-drafts',event=>{
  if(!active)return;el('draft-buttons').replaceChildren();
  if(event.detail?.available===false){el('draft-buttons').textContent='Article list unavailable. Refresh status to try again.';return;}
  const rows=event.detail?.rows||[];if(!rows.length){el('draft-buttons').textContent='No saved editorial articles to view yet.';return;}
  for(const draft of rows){const button=document.createElement('button');button.type='button';button.textContent=`View: ${draft.title}`;button.addEventListener('click',()=>openDraft(draft.id));el('draft-buttons').append(button);}
 });
})();
