import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const elements=new Map(),pending=[];let poll;
function element(id){if(!elements.has(id))elements.set(id,{hidden:id==='owner-dashboard',disabled:false,textContent:'',replaceChildren(){this.textContent='';},addEventListener(name,fn){this[name]=fn;},append(){}});return elements.get(id);}
const context=vm.createContext({document:{getElementById:element,createElement:()=>({append(){}})},fetch:()=>new Promise(resolve=>pending.push(resolve)),setInterval(fn){poll=fn;},Date,encodeURIComponent});
vm.runInContext(await readFile('web/vercel/owner.js','utf8'),context);
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
