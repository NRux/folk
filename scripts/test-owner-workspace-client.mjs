import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const listeners={},elements=new Map();
function element(){return {value:'',textContent:'',children:[],addEventListener(){},replaceChildren(...children){this.children=children;this.textContent='';},append(...children){this.children.push(...children);}};}
const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},addEventListener(name,fn){listeners[name]=fn;},createElement:element};
let resolve;const fetch=()=>new Promise(r=>{resolve=r;});
vm.runInNewContext(await readFile('web/vercel/owner-workspace.js','utf8'),{document,fetch,window:{},crypto:{randomUUID:()=>''}});
listeners['owner-session']({detail:{signedIn:true}});
listeners['owner-session']({detail:{signedIn:false}});
resolve({status:200,ok:true,json:async()=>({ideas:[],chat:[{message:'private',response:'secret'}],chatAvailable:true})});
await new Promise(r=>setImmediate(r));
assert.equal(elements.get('editor-history').children.length,0);assert.equal(elements.get('editor-status').textContent,'');assert.equal(elements.get('ideas-status').textContent,'');
console.log('Owner workspace client passed: logout clears panels and rejects late private responses.');
