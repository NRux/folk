// Owner approved Resend for consenting newsletter recipients on 2026-10-08.
export function createResendSender(fetcher=fetch) {
 return async (payload,key,apiKey)=>{
  const response=await fetcher('https://api.resend.com/emails',{
   method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':key},
   body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)
  });
  if(!response.ok)throw Error('Delivery unavailable');
  const result=await response.json();
  if(typeof result.id!=='string'||!result.id)throw Error('Missing receipt');
  return {id:result.id};
 };
}
