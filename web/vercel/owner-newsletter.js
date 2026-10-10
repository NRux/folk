(() => {
 const el=id=>document.getElementById(id);
 let active=false,sequence=0,controller;
 function clear(){sequence++;controller?.abort();controller=null;for(const id of ['newsletter-readiness','newsletter-stories','newsletter-digest','newsletter-preview-status','newsletter-window'])el(id).replaceChildren();el('newsletter-preview-refresh').disabled=true;}
 function render(data) {
  const readiness=data.readiness,preview=data.preview;
  const delivery=document.createElement('p');delivery.textContent=`Delivery setting: ${readiness.deliveryEnabled?'On':'Off'}. Hosted delivery acceptance is still pending.`;
  const config=document.createElement('p');config.textContent=readiness.configurationComplete?'Required settings are present. Provider credentials and mailbox delivery still need hosted verification.':`Missing or invalid settings: ${readiness.missing.join(', ')}.`;
  el('newsletter-readiness').replaceChildren(delivery,config);
  el('newsletter-stories').replaceChildren();el('newsletter-digest').replaceChildren();el('newsletter-window').replaceChildren();
  if(!preview.available){el('newsletter-preview-status').textContent='Digest preview unavailable. Refresh to try again.';return;}
  el('newsletter-window').textContent=`Next run: ${new Date(preview.runAt).toLocaleString()} (browser local time). Includes publication dates ${preview.from} through ${preview.until} exclusive, in UTC.`;
  for(const story of preview.stories){if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(story.slug))throw Error();const li=document.createElement('li'),link=document.createElement('a');link.href=`https://www.folkly.com/${story.slug}`;link.textContent=story.title;li.append(link);el('newsletter-stories').append(li);}
  el('newsletter-digest').textContent=`Subject: ${preview.subject}\n\n${preview.text}`;
  el('newsletter-preview-status').textContent=preview.empty?'No stories qualify yet. Empty weeks send no email.':'Preview loaded. No email was sent.';
 }
 async function load() {
  if(!active)return;
  controller?.abort();controller=new AbortController();const current=++sequence;
  el('newsletter-preview-refresh').disabled=true;el('newsletter-preview-status').textContent='Loading newsletter status and preview…';
  try {
   const response=await fetch('/api/owner-newsletter',{cache:'no-store',signal:controller.signal});
   const data=await response.json();if(!active||current!==sequence)return;
   if(response.status===401){clear();if(typeof window.expireOwnerSession==='function')window.expireOwnerSession();else if(typeof window.signedIn==='function')window.signedIn(false);return;}
   if(!response.ok||!data.owner||!data.newsletter)throw Error();
   render(data.newsletter);
  }catch {
   if(active&&current===sequence){for(const id of ['newsletter-readiness','newsletter-stories','newsletter-digest','newsletter-window'])el(id).replaceChildren();el('newsletter-preview-status').textContent='Newsletter status unavailable. Refresh to try again.';}
  }finally {if(active&&current===sequence)el('newsletter-preview-refresh').disabled=false;}
 }
 el('newsletter-preview-refresh').addEventListener('click',load);
 document.addEventListener('owner-session',event=>{const previous=active;active=event.detail.signedIn;if(!active)clear();else if(!previous)load();});
 clear();
})();
