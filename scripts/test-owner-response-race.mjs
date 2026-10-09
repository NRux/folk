import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const elements=new Map(),pending=[];let poll;
const html=await readFile('web/vercel/owner.html','utf8');
for(const [,id] of html.matchAll(/\bid="([^"]+)"/g))elements.set(id,{hidden:id==='owner-dashboard',disabled:false,textContent:'',replaceChildren(){this.textContent='';},addEventListener(name,fn){this[name]=fn;},append(){}});
function element(id){return elements.get(id)||null;}
for(const file of ['owner.js','owner-workspace.js','owner-translations.js']){
 const source=await readFile(`web/vercel/${file}`,'utf8');
 for(const [,id] of source.matchAll(/\bel\('([^']+)'\)/g))assert(elements.has(id),`${file} requires missing HTML element ${id}`);
}
const context=vm.createContext({document:{getElementById:element,createElement:()=>({append(){}})},fetch:()=>new Promise(resolve=>pending.push(resolve)),setInterval(fn){poll=fn;},Date,encodeURIComponent});
vm.runInContext(await readFile('web/vercel/owner.js','utf8'),context);
assert.equal(typeof element('owner-form').submit,'function');
assert.equal(typeof element('owner-refresh').click,'function');
assert.equal(typeof element('owner-logout').click,'function');
assert.equal(typeof element('owner-subscriber-first').click,'function');
assert.equal(pending.length,1);
context.signedIn(false);
pending.shift()({ok:true,json:async()=>({owner:true,dashboard:{}})});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(element('owner-dashboard').hidden,true);
context.signedIn(true);
const paging=context.loadContacts('page2');
context.signedIn(false);
pending.shift()({ok:true,status:200,json:async()=>({owner:true,contacts:{available:true,rows:[{message:'private'}],nextCursor:null}})});
await paging;
assert.equal(element('owner-dashboard').hidden,true);assert.equal(element('owner-contacts').textContent,'');assert.equal(element('owner-contact-next').disabled,true);
const subscriberPaging=context.loadSubscribers('page2');
context.signedIn(false);
pending.shift()({ok:true,status:200,json:async()=>({owner:true,subscribers:{available:true,rows:[{email:'private@example.com'}],nextCursor:null}})});
await subscriberPaging;
assert.equal(element('owner-dashboard').hidden,true);assert.equal(element('owner-subscriber-list').textContent,'');assert.equal(element('owner-subscriber-next').disabled,true);
console.log('Owner late-response checks passed: pending status, contact and subscriber responses cannot restore private UI after sign-out.');

// A valid session that later receives 401 must explain the transition, clear private
// panels/codes and stop polling. Initial anonymous load is an ordinary sign-in screen.
context.signedIn(true);element('owner-contacts').textContent='private message';element('owner-code').value='123456';
poll();assert.equal(pending.length,1);pending.shift()({ok:false,status:401,json:async()=>({message:'Owner sign-in required.'})});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(element('owner-dashboard').hidden,true);assert.equal(element('owner-contacts').textContent,'');assert.equal(element('owner-code').value,'');assert.match(element('owner-status').textContent,/session expired or is no longer active/);
poll();assert.equal(pending.length,0);
context.signedIn(true);const refreshed=element('owner-refresh').click();pending.shift()({ok:false,status:401,json:async()=>({message:'Owner sign-in required.'})});await refreshed;assert.match(element('owner-status').textContent,/Request a new sign-in code/);
element('owner-status').textContent='';const anonymous=context.loadStatus();pending.shift()({ok:false,status:401,json:async()=>({message:'Sign in to view owner status.'})});await anonymous;assert.equal(element('owner-status').textContent,'');
console.log('Owner expiry passed: automatic/manual 401 explains reauthentication, clears private UI and code, stops polls; initial anonymous 401 stays neutral.');

const empty={available:true,rows:[]};
const authenticated=context.loadStatus();
pending.shift()({ok:true,status:200,json:async()=>({owner:true,settings:{'production.autonomous_enabled':'false','publication.autonomous_enabled':'false','schedule.enabled':'false'},dashboard:{generatedAt:'2026-10-09T17:00:00Z',migration:{message:'Content available.'},sections:{budget:empty,articles:empty,jobs:empty,contacts:empty,reservations:empty}}})});
await authenticated;
assert.equal(element('owner-dashboard').hidden,false);
assert.equal(element('owner-login').hidden,true);
assert.equal(pending.length,1,'Authenticated rendering starts subscriber loading');
pending.shift()({ok:true,status:200,json:async()=>({owner:true,subscribers:{available:true,rows:[],nextCursor:null,hasMore:false}})});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(element('owner-subscriber-list').textContent,'No subscriber records saved.');
assert.equal(element('owner-subscriber-first').disabled,false);
assert.equal(element('owner-subscriber-next').disabled,true);
context.signedIn(false);
assert.equal(element('owner-subscriber-list').textContent,'');
console.log('Actual owner HTML passed: all three scripts have their required controls; login/refresh/logout listeners attach, authenticated dashboard and subscriber loading complete, private state clears on sign-out.');
