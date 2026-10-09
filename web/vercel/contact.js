const form=document.querySelector('#contact-form');
const contactText=(key,fallback)=>(typeof window!=='undefined'?window.FolklyUI:null)?.t(key,fallback)||fallback;
if(form)form.addEventListener('submit',async event=>{
  event.preventDefault();
  const button=form.querySelector('button'),status=document.querySelector('#contact-status');
  button.disabled=true;status.textContent=contactText('contactSaving','Saving your message…');
  try{
    const response=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});
    const result=await response.json();
    status.textContent=typeof window!=='undefined'&&window.FolklyUI?contactText(response.ok?'contactSaved':response.status>=500?'contactUnavailable':'contactInvalid',result.message):result.message;
    if(response.ok)form.reset();
  }catch{status.textContent=contactText('contactConnection','Could not connect. Your message has not been confirmed saved. Please try again.');}
  finally{button.disabled=false;}
});
