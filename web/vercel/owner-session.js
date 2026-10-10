(()=>{
 let freshUntil=0,pending=null,generation=0;
 const allowed=/^\/api\/(?:owner|owner-workspace|owner-translations|owner-newsletter|owner-newsletter-test)(?:\?|$)/;
 document.addEventListener('owner-session',event=>{if(!event.detail.signedIn){generation++;freshUntil=0;pending=null;}});
 async function renew(){
  if(Date.now()<freshUntil)return null;
  if(pending)return pending;
  const current=generation;
  const run=async()=>{
   const response=await fetch('/api/owner',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'refresh'}),signal:AbortSignal.timeout(20000)});
   const data=await response.clone().json();
   if(current!==generation)return Response.json({message:'Owner session changed.'},{status:401});
   if(response.ok&&Number.isSafeInteger(data.expiresIn)&&data.expiresIn>0&&data.expiresIn<=900)freshUntil=Date.now()+Math.max(0,data.expiresIn-60)*1000;
   else return response.ok?Response.json({message:'Saved sign-in could not be verified.'},{status:503}):response;
   return null;
  };
  // Share a single refresh within this tab; Web Locks also serialize same-origin tabs.
  const promise=(typeof navigator!=='undefined'&&navigator.locks?.request?navigator.locks.request('folkly-owner-renewal',run):run()).finally(()=>{if(pending===promise)pending=null;});
  pending=promise;return promise;
 }
 window.ownerFetch=async(url,options={})=>{
  if(typeof url!=='string'||!allowed.test(url)||(url==='/api/owner'&&options.method==='POST'))return fetch(url,options);
  const current=generation,result=await renew();
  options.signal?.throwIfAborted();
  if(current!==generation)return Response.json({message:'Owner session changed.'},{status:401});
  if(result)return result.clone();
  // No automatic replay of private writes, editor calls or paid batches.
  const response=await fetch(url,options);
  if(response.status===401){
   freshUntil=0;
   // Only read-only GETs can be repeated after renewal. Never replay mutations.
   if(!options.method||options.method==='GET'){
    const recovered=await renew();options.signal?.throwIfAborted();
    if(current!==generation)return Response.json({message:'Owner session changed.'},{status:401});
    return recovered?recovered.clone():fetch(url,options);
   }
  }
  return response;
 };
})();
