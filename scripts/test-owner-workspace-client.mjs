import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const listeners={},elements=new Map();
function element(tag='div'){return {tagName:tag.toUpperCase(),value:'',textContent:'',children:[],disabled:false,setAttribute(){},focus(){},querySelector(){return this.button||(this.button=element('button'));},addEventListener(n,f){this[n]=f;},replaceChildren(...children){this.children=children;this.textContent='';},append(...children){this.children.push(...children);}};}
const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},addEventListener(name,fn){listeners[name]=fn;},createElement:element};
let resolve,expired=0;const fetch=()=>new Promise(r=>{resolve=r;});
vm.runInNewContext(await readFile('web/vercel/owner-workspace.js','utf8'),{document,fetch,window:{expireOwnerSession(){expired++;listeners['owner-session']({detail:{signedIn:false}});}},crypto:{randomUUID:()=>''}});
listeners['owner-session']({detail:{signedIn:true}});
listeners['owner-session']({detail:{signedIn:false}});
resolve({status:200,ok:true,json:async()=>({ideas:[],chat:[{message:'private',response:'secret'}],chatAvailable:true})});
await new Promise(r=>setImmediate(r));
assert.equal(elements.get('editor-history').children.length,0);assert.equal(elements.get('editor-status').textContent,'');assert.equal(elements.get('ideas-status').textContent,'');
console.log('Owner workspace client passed: logout clears panels and rejects late private responses.');

listeners['owner-session']({detail:{signedIn:true}});
resolve({status:401,ok:false,json:async()=>({message:'Owner sign-in required.'})});
await new Promise(r=>setImmediate(r));assert.equal(expired,1);assert.equal(elements.get('editor-history').children.length,0);
console.log('Workspace expiry passed: private endpoint 401 invokes the shared reauthentication notice and clears drafts/chat.');

const tick=()=>new Promise(r=>setImmediate(r));
listeners['owner-session']({detail:{signedIn:true}});
const empty={ideas:[],chat:[],ideasAvailable:true,chatHistoryAvailable:true,chatAvailable:true};
resolve({status:200,ok:true,json:async()=>empty});await tick();
elements.get('idea-add').click();const row=elements.get('ideas-body').children[0];
const title=row.children[0].children[0],notes=row.children[4].children[0],save=row.children[7].children[0],notice=row.children[7].children[1];
title.value='My idea';notes.value='Keep this unsaved text';
const refresh=elements.get('workspace-refresh').click();resolve({status:200,ok:true,json:async()=>empty});await refresh;
assert.equal(elements.get('ideas-body').children[0],row);assert.equal(notes.value,'Keep this unsaved text');
const saving=save.click();assert.equal(save.disabled,true);assert.equal(title.disabled,true);assert.match(notice.textContent,/Saving and verifying/);
resolve({status:503,ok:false,json:async()=>({message:'Storage unavailable. Keep your text.'})});await saving;assert.equal(notes.value,'Keep this unsaved text');assert.match(notice.textContent,/Storage unavailable/);
const retry=save.click();resolve({status:200,ok:true,json:async()=>({idea:{etag:'verified-revision'}})});await retry;assert.equal(notice.textContent,'Saved and verified.');
const delayedList=elements.get('workspace-refresh').click();resolve({status:200,ok:true,json:async()=>empty});await delayedList;assert.equal(elements.get('ideas-body').children[0],row);assert.match(elements.get('ideas-status').textContent,/storage list catches up/);
notes.value='Another unsaved edit';
const partial=elements.get('workspace-refresh').click();resolve({status:200,ok:true,json:async()=>({...empty,ideasAvailable:false,ideasMessage:'Ideas unavailable',chat:[{message:'hello',response:'reply'}]})});await partial;assert.equal(notes.value,'Another unsaved edit');assert(elements.get('editor-history').children[0].textContent.includes('reply'));
elements.get('editor-message').value='hello';const sending=elements.get('editor-form').submit({preventDefault(){},currentTarget:elements.get('editor-form')});assert.match(elements.get('editor-status').textContent,/responding/);resolve({status:503,ok:false,json:async()=>({message:'Provider unavailable'})});await sending;assert.equal(elements.get('editor-message').value,'hello');assert.equal(elements.get('editor-status').textContent,'Provider unavailable');
const diagnosticSend=elements.get('editor-form').submit({preventDefault(){},currentTarget:elements.get('editor-form')});
resolve({status:503,ok:false,json:async()=>({message:'Provider rejected this request.',code:'MODEL_REQUEST_REJECTED',stage:'provider'})});await diagnosticSend;
assert.match(elements.get('editor-status').textContent,/Diagnostic: MODEL_REQUEST_REJECTED \(provider\)/);
for(const code of ['MODEL_OUTPUT_LIMIT','MODEL_CONTENT_FILTER']){
 const send=elements.get('editor-form').submit({preventDefault(){},currentTarget:elements.get('editor-form')});
 resolve({status:503,ok:false,json:async()=>({message:'Reply unavailable; retained attempt.',code,stage:'provider'})});await send;
 assert(elements.get('editor-status').textContent.includes('Diagnostic: '+code+' (provider)'));assert.equal(elements.get('editor-message').value,'hello');
}
const unsafeSend=elements.get('editor-form').submit({preventDefault(){},currentTarget:elements.get('editor-form')});
resolve({status:503,ok:false,json:async()=>({message:'Unavailable.',code:'secret-provider-body',stage:'private-record'})});await unsafeSend;
assert.equal(elements.get('editor-status').textContent,'Unavailable.');
listeners['owner-session']({detail:{signedIn:false}});assert.equal(elements.get('ideas-body').children.length,0);
console.log('Workspace interaction passed: unsaved rows survive refresh/partial outages, row save progress and verified acknowledgement are visible, failures retain input, editor progress/errors are visible and logout clears all private state.');
