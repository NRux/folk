import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createOwnerNewsletterHandler,readOwnerNewsletter} from '../server/owner-newsletter.js';
import {newsletterConfigFromEnv,newsletterMissingConfig} from '../server/newsletter-config.js';
import {validateNewsletterCatalog,readNewsletterCatalog} from '../server/newsletter-catalog.js';
import {createOwnerHandlers} from '../server/owner-auth.js';

const env={NEWSLETTER_ENABLED:'false',CRON_SECRET:'fixture-cron-private',RESEND_API_KEY:'fixture-provider-private',NEWSLETTER_FROM:'Folkly <fixture-private@example.com>',NEWSLETTER_POSTAL_ADDRESS:'fixture-private-postal-address',NEWSLETTER_SECRET:'fixture-signing-private-'.repeat(3),BLOB_STORE_ID:'fixture-private-blob'};
const cfg=newsletterConfigFromEnv(env);assert.deepEqual(newsletterMissingConfig(cfg),[]);
for(const name of ['CRON_SECRET','RESEND_API_KEY','NEWSLETTER_FROM','NEWSLETTER_POSTAL_ADDRESS','NEWSLETTER_SECRET'])assert(newsletterMissingConfig(newsletterConfigFromEnv({...env,[name]:''})).includes(name));
assert(newsletterMissingConfig(newsletterConfigFromEnv({...env,BLOB_STORE_ID:''})).includes('PRIVATE_BLOB_CONNECTION'));
assert(newsletterMissingConfig({...cfg,from:'sender\r\nInjected: header'}).includes('NEWSLETTER_FROM'));
assert(newsletterMissingConfig({...cfg,secret:'short'}).includes('NEWSLETTER_SECRET'));

const stories=[
 {slug:'included-story',title:'A <script>title</script>',summary:'Public context',status:'published',publishedAt:'2026-10-09',privateText:'never-leak-body'},
 {slug:'older-story',title:'Earlier story',status:'published',publishedAt:'2026-10-08'},
 {slug:'friday-story',title:'Friday story',status:'published',publishedAt:'2026-10-16'},
 {slug:'private-draft',title:'PRIVATE SECRET',status:'draft',publishedAt:'2026-10-10'},
 {slug:'unrouted',title:'NOT RELEASED',status:'published',publishedAt:'2026-10-10'},
];
const routes=Object.fromEntries(stories.filter(x=>x.slug!=='unrouted').map(x=>[`/${x.slug}`,`${x.slug}.html`]));
const catalog=async()=>validateNewsletterCatalog(stories,routes),now=()=>new Date('2026-10-10T01:00:00Z');
const result=await readOwnerNewsletter({env,catalog,now});
assert.equal(result.readiness.deliveryEnabled,false);assert.equal(result.readiness.configurationComplete,true);assert.equal(result.readiness.hostedAcceptance,'pending');
assert.equal(result.preview.runAt,'2026-10-16T16:00:00.000Z');assert.equal(result.preview.from,'2026-10-09');assert.equal(result.preview.until,'2026-10-16');
assert.deepEqual(result.preview.stories.map(x=>x.slug),['included-story']);
assert(result.preview.text.includes('[Personal unsubscribe link added for each recipient]'));
for(const value of Object.values(env))if(value.startsWith('fixture')||value.includes('fixture-private'))assert(!JSON.stringify(result).includes(value),'Never serialize environment values');
assert(!JSON.stringify(result).includes('never-leak-body'));assert(!JSON.stringify(result).includes('PRIVATE SECRET'));assert(!JSON.stringify(result).includes('NOT RELEASED'));
const exactly=await readOwnerNewsletter({env,catalog,now:()=>new Date('2026-10-09T16:00:00Z')});assert.equal(exactly.preview.runAt,result.preview.runAt);
const before=await readOwnerNewsletter({env,catalog,now:()=>new Date('2026-10-09T15:59:59Z')});assert.equal(before.preview.runAt,'2026-10-09T16:00:00.000Z');assert.deepEqual(before.preview.stories.map(x=>x.slug),['older-story']);
const dst=await readOwnerNewsletter({env,catalog,now:()=>new Date('2026-11-01T08:59:59Z')});assert.equal(dst.preview.runAt,'2026-11-06T16:00:00.000Z');
const empty=await readOwnerNewsletter({env,catalog:async()=>[],now});assert.equal(empty.preview.empty,true);
const partial=await readOwnerNewsletter({env,catalog:async()=>{throw Error('credential failure');},now});assert.equal(partial.preview.available,false);assert.equal(partial.readiness.configurationComplete,true);assert(!JSON.stringify(partial).includes('credential failure'));
assert.equal((await readOwnerNewsletter({env:{},catalog:async()=>[],now})).readiness.missing.length,6);
assert.equal((await readOwnerNewsletter({env:{...env,NEWSLETTER_ENABLED:'true'},catalog,now})).readiness.deliveryEnabled,true,'Do not claim paused when the actual setting is on');

for(const bad of [
 [...stories,stories[0]],
 [{...stories[0],slug:'../private'}],
 [{...stories[0],publishedAt:'2026-02-30'}],
 [{...stories[0],title:'x'.repeat(401)}],
 [{...stories[0],summary:{privateText:'secret'}}],
])assert.throws(()=>validateNewsletterCatalog(bad,routes));
assert.throws(()=>validateNewsletterCatalog(stories,{...routes,'/included-story':'owner.html'}));
assert.equal((await readNewsletterCatalog()).length,11,'Existing public catalog remains intact');

let authorized=false,reads=0;
const handler=createOwnerNewsletterHandler({env,authorize:async()=>authorized?{}:null,catalog:async()=>{reads++;return catalog();},now});
const request=(path='',method='GET')=>new Request('https://www.folkly.com/api/owner-newsletter'+path,{method});
assert.equal((await handler(request())).status,401);assert.equal(reads,0);
assert.equal((await handler(request('', 'POST'))).status,405);assert.equal(reads,0);
authorized=true;
assert.equal((await handler(request('?runAt=2026-10-09'))).status,400);assert.equal(reads,0);
const response=await handler(request());assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');assert.equal((await response.json()).owner,true);assert.equal(reads,1);
const unavailable=createOwnerNewsletterHandler({env,authorize:async()=>{throw Error('private auth failure');},catalog:()=>assert.fail('No catalog on auth outage')});const denied=await unavailable(request());assert.equal(denied.status,503);assert(!await denied.text().then(t=>t.includes('private auth failure')));

// Exercise the existing private membership and live-session authorization path.
const sid='00000000-0000-0000-0000-000000000001',token=`head.${Buffer.from(JSON.stringify({session_id:sid})).toString('base64url')}.signature`;
let active=true,member=true,authReads=0;
const ownerEnv={...env,FOLKLY_OWNER_EMAIL:'owner@example.com',SUPABASE_URL:'https://vxmyggasjgsiohqzzwzh.supabase.co',SUPABASE_PUBLISHABLE_KEY:'fixture-public'};
const authClient={auth:{getUser:async()=>({data:{user:{id:sid,email:ownerEnv.FOLKLY_OWNER_EMAIL}}})}};
const editorialClient={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:member?{user_id:sid}:null})})})}),rpc:async()=>({data:active})};
const secured=createOwnerNewsletterHandler({env:ownerEnv,authorize:createOwnerHandlers({env:ownerEnv,authClient,editorialClient}).authorize,catalog:async()=>{authReads++;return [];},now});
const signedRequest=()=>new Request(request().url,{headers:{cookie:`__Host-folkly-owner=${token}`}});
assert.equal((await secured(signedRequest())).status,200);member=false;assert.equal((await secured(signedRequest())).status,401);member=true;active=false;assert.equal((await secured(signedRequest())).status,401);assert.equal(authReads,1);
console.log('Owner newsletter server passed: shared worker configuration/catalog, next-Friday/date-only/DST windows, public-only allowlist, no secret/address/token payload, owner/membership/session/method/query denial and independent preview outage. No provider or private Blob calls.');

const html=await readFile('web/vercel/owner.html','utf8'),source=await readFile('web/vercel/owner-newsletter.js','utf8');
const elements=new Map(),listeners={},pending=[];
function element(tag='div'){return {tag,children:[],textContent:'',disabled:false,replaceChildren(...children){this.children=children;this.textContent='';},append(...children){this.children.push(...children);},addEventListener(name,fn){this[name]=fn;}};}
for(const [,id] of html.matchAll(/\bid="([^"]+)"/g))elements.set(id,element());
for(const [,id] of source.matchAll(/\bel\('([^']+)'\)/g))assert(elements.has(id),`Missing HTML control ${id}`);
let expirations=0;
const document={getElementById:id=>elements.get(id),createElement:element,addEventListener:(name,fn)=>listeners[name]=fn};
vm.runInNewContext(source,{document,AbortController,Date,window:{expireOwnerSession(){expirations++;listeners['owner-session']({detail:{signedIn:false}});}},fetch:(url,args)=>{assert.equal(url,'/api/owner-newsletter');assert.equal(args.cache,'no-store');assert.equal(args.method,undefined);return new Promise(resolve=>pending.push(resolve));}});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const body={owner:true,newsletter:result},resolve=body=>pending.shift()({ok:true,status:200,json:async()=>body});
listeners['owner-session']({detail:{signedIn:true}});assert.equal(pending.length,1);assert.equal(elements.get('newsletter-preview-refresh').disabled,true);
resolve(body);await tick();assert.equal(elements.get('newsletter-preview-refresh').disabled,false);assert(elements.get('newsletter-digest').textContent.includes('A <script>title</script>'));assert.equal(elements.get('newsletter-stories').children[0].children[0].textContent,stories[0].title);assert.equal(elements.get('newsletter-stories').children[0].children[0].href,'https://www.folkly.com/included-story');
const first=elements.get('newsletter-preview-refresh').click(),second=elements.get('newsletter-preview-refresh').click();
pending[1]({ok:true,status:200,json:async()=>({owner:true,newsletter:empty})});pending.splice(1,1);await second;assert.match(elements.get('newsletter-preview-status').textContent,/No stories qualify/);
resolve(body);await first;assert.match(elements.get('newsletter-preview-status').textContent,/No stories qualify/,'Late earlier preview cannot replace current one');
const late=elements.get('newsletter-preview-refresh').click();listeners['owner-session']({detail:{signedIn:false}});resolve(body);await late;assert.equal(elements.get('newsletter-digest').textContent,'');assert.equal(elements.get('newsletter-stories').children.length,0);assert.equal(elements.get('newsletter-preview-refresh').disabled,true);
listeners['owner-session']({detail:{signedIn:true}});pending.shift()({ok:false,status:401,json:async()=>({message:'Sign in'})});await tick();assert.equal(expirations,1);assert.equal(elements.get('newsletter-readiness').children.length,0);
assert(!source.includes('innerHTML'));assert(!source.includes('method:'));
const dist=await readFile('dist/owner.html','utf8');assert(dist.includes('src="/owner-newsletter.js"'));assert.equal(await readFile('dist/owner-newsletter.js','utf8'),source);
const vercel=JSON.parse(await readFile('vercel.json','utf8'));assert.equal(vercel.functions['api/owner-newsletter.js'].includeFiles,'web/vercel/{articles,routes}.json');
console.log('Owner newsletter client passed: actual controls/assets, loading/refresh, safe text and public links, empty state, late refresh/logout denial, session expiry and GET-only interaction. No mail sent.');
