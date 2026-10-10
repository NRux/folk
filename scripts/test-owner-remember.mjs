import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createOwnerHandlers,rememberedToken} from '../server/owner-auth.js';
const env={FOLKLY_OWNER_EMAIL:'owner@example.com',SUPABASE_URL:'https://vxmyggasjgsiohqzzwzh.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'};
const sid='00000000-0000-0000-0000-000000000001';
const token=`head.${Buffer.from(JSON.stringify({session_id:sid,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.signature`;
let member=true,active=true,refreshError,refreshCalls=0,revoked=[],getError;
const authClient={auth:{
 getUser:async value=>({data:{user:value===token?{id:sid,email:env.FOLKLY_OWNER_EMAIL}:null},...(getError?{error:getError}:{})}),
 verifyOtp:async()=>({data:{session:{access_token:token,refresh_token:'remembered-private-token',expires_at:Date.now()/1000+3600}}}),
 refreshSession:async args=>{refreshCalls++;assert.equal(args.refresh_token,'remembered-private-token');return refreshError?{error:refreshError}:{data:{session:{access_token:token,refresh_token:'rotated-private-token',expires_at:Date.now()/1000+3600}}};},
}};
const editorialClient={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:member?{user_id:sid}:null})})})}),rpc:async()=>({data:active}),auth:{admin:{signOut:async(value,scope)=>{revoked.push({value,scope});return {};}}}};
const handler=createOwnerHandlers({env,authClient,editorialClient});
const request=(body,cookies='',origin='https://www.folkly.com')=>new Request('https://www.folkly.com/api/owner',{method:'POST',headers:{cookie:cookies,origin,'content-type':'application/json'},body:JSON.stringify(body)});
const verify={action:'verify',email:env.FOLKLY_OWNER_EMAIL,code:'123456',remember:true};
let response=await handler.POST(request(verify));assert.equal(response.status,200);
const cookies=response.headers.getSetCookie();assert.equal(cookies.length,2);
assert.ok(cookies.every(c=>c.includes('Path=/; Secure; HttpOnly; SameSite=Strict')));
assert.match(cookies[1],/^__Host-folkly-owner-refresh=.*Max-Age=2592000$/);assert.ok(!cookies.some(c=>/Domain=/i.test(c)));
assert.ok(!(await response.text()).includes('private-token'));
response=await handler.POST(request({...verify,remember:false}));assert.match(response.headers.getSetCookie()[1],/Max-Age=0$/);
assert.equal((await handler.POST(request({...verify,remember:'true'}))).status,400);
const remembered='__Host-folkly-owner-refresh=remembered-private-token';
response=await handler.POST(request({action:'refresh'},remembered));assert.equal(response.status,200);assert.equal(refreshCalls,1);
assert.match(response.headers.getSetCookie()[1],/rotated-private-token/);assert.ok(!(await response.text()).includes('private-token'));
response=await handler.POST(request({action:'refresh'},`__Host-folkly-owner=${token}; ${remembered}`));assert.equal(response.status,200);assert.equal(refreshCalls,1,'Valid access renews its short cookie without rotating refresh credentials');
assert.equal(response.headers.getSetCookie().length,1);
member=false;response=await handler.POST(request({action:'refresh'},remembered));assert.equal(response.status,401);assert.ok(response.headers.getSetCookie().every(c=>c.endsWith('Max-Age=0')));member=true;
active=false;assert.equal((await handler.POST(request({action:'refresh'},remembered))).status,401);active=true;
const before=refreshCalls;assert.equal(rememberedToken(request({},`${remembered}; ${remembered}`)),'');assert.equal((await handler.POST(request({action:'refresh'},`${remembered}; ${remembered}`))).status,401);assert.equal(refreshCalls,before);
assert.equal((await handler.POST(request({action:'refresh'},remembered,'https://evil.local'))).status,403);assert.equal(refreshCalls,before);
refreshError={status:400,code:'refresh_token_not_found'};response=await handler.POST(request({action:'refresh'},remembered));assert.equal(response.status,401);assert.equal(response.headers.getSetCookie().length,2);
for(const status of [429,503]){refreshError={status};response=await handler.POST(request({action:'refresh'},remembered));assert.equal(response.status,503);assert.equal(response.headers.getSetCookie().length,0,'Outage retains remembered credentials');}
refreshError=undefined;getError={status:503};response=await handler.POST(request({action:'refresh'},remembered));assert.equal(response.status,503);assert.equal(response.headers.getSetCookie().length,0);getError=undefined;
response=await handler.POST(request({action:'logout'},remembered));assert.equal(response.status,200);assert.equal(revoked.at(-1).value,token);assert.equal(revoked.at(-1).scope,'global');assert.equal(response.headers.getSetCookie().length,2);assert.ok(response.headers.getSetCookie().every(c=>c.endsWith('Max-Age=0')));
refreshError={status:503};response=await handler.POST(request({action:'logout'},remembered));assert.equal(response.status,503);assert.equal(response.headers.getSetCookie().length,2);

let clock=0;const pending=[],events={};
const context=vm.createContext({window:{},document:{addEventListener:(name,fn)=>events[name]=fn},fetch:(url,options={})=>new Promise(resolve=>pending.push({url,options,resolve})),Response,AbortSignal,Date:class extends Date{static now(){return clock;}}});
vm.runInContext(await readFile('web/vercel/owner-session.js','utf8'),context);
const fetch=context.window.ownerFetch;
const a=fetch('/api/owner-workspace',{method:'POST',body:'paid action'}),b=fetch('/api/owner-translations');
assert.equal(pending.length,1);assert.equal(JSON.parse(pending[0].options.body).action,'refresh');
pending.shift().resolve(Response.json({expiresIn:900}));await new Promise(resolve=>setImmediate(resolve));
assert.equal(pending.length,2);pending.splice(0).forEach(p=>p.resolve(Response.json({ok:true})));await Promise.all([a,b]);
const cached=fetch('/api/owner-newsletter');await new Promise(resolve=>setImmediate(resolve));assert.equal(pending.length,1);assert.equal(pending[0].url,'/api/owner-newsletter');pending.shift().resolve(Response.json({ok:true}));await cached;
clock=900000;const gated=fetch('/api/owner-workspace',{method:'POST',body:'must not replay'});assert.equal(pending.length,1);pending.shift().resolve(Response.json({message:'unavailable'},{status:503}));assert.equal((await gated).status,503);assert.equal(pending.length,0);
const stale=fetch('/api/owner-translations',{method:'POST',body:'must not send'});events['owner-session']({detail:{signedIn:false}});pending.shift().resolve(Response.json({expiresIn:900}));assert.equal((await stale).status,401);assert.equal(pending.length,0);
const login=fetch('/api/owner',{method:'POST',body:'login'});assert.equal(pending.length,1);assert.equal(pending[0].options.body,'login');pending.shift().resolve(Response.json({ok:true}));await login;
const recovered=fetch('/api/owner-newsletter');pending.shift().resolve(Response.json({expiresIn:900}));await new Promise(resolve=>setImmediate(resolve));
assert.equal(pending[0].url,'/api/owner-newsletter');pending.shift().resolve(Response.json({message:'expired'},{status:401}));await new Promise(resolve=>setImmediate(resolve));
assert.equal(pending[0].url,'/api/owner');pending.shift().resolve(Response.json({expiresIn:900}));await new Promise(resolve=>setImmediate(resolve));
assert.equal(pending[0].url,'/api/owner-newsletter');pending.shift().resolve(Response.json({ok:true}));assert.equal((await recovered).status,200);
const noReplay=fetch('/api/owner-workspace',{method:'POST',body:'one attempt'});await new Promise(resolve=>setImmediate(resolve));
assert.equal(pending[0].url,'/api/owner-workspace');pending.shift().resolve(Response.json({message:'expired'},{status:401}));assert.equal((await noReplay).status,401);assert.equal(pending.length,0,'POST 401 is never renewed/replayed automatically');
const html=await readFile('web/vercel/owner.html','utf8');assert.ok(html.indexOf('/owner-session.js')<html.indexOf('/owner.js'));assert.match(html,/id="owner-remember" type="checkbox" checked/);
assert.ok(!(await readFile('web/vercel/owner-session.js','utf8')).includes('localStorage'));assert.ok(!(await readFile('web/vercel/owner-session.js','utf8')).includes('document.cookie'));
console.log('Remembered owner sign-in passed: private secure host cookies, opted-in 30-day renewal, rotated refresh credentials, owner/session revocation, outage preservation, refresh-only logout, serialized preflight, logout race denial and zero replay of paid/private actions.');
