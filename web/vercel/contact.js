const form=document.querySelector('#contact-form');
if(form)form.addEventListener('submit',async event=>{
  event.preventDefault();
  const button=form.querySelector('button'),status=document.querySelector('#contact-status');
  button.disabled=true;status.textContent='Saving your message…';
  try{
    const response=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});
    const result=await response.json();
    status.textContent=result.message;
    if(response.ok)form.reset();
  }catch{status.textContent='Could not connect. Your message has not been confirmed saved. Please try again.';}
  finally{button.disabled=false;}
});
