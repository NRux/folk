import {readFile} from 'node:fs/promises';
import {createOwnerHandlers} from '../server/owner-auth.js';
import {createTranslationStore} from '../server/content-store.js';
import {createTranslationHandlers} from '../server/owner-translations.js';
const auth=createOwnerHandlers();
const handlers=createTranslationHandlers({authorize:request=>auth.authorize(request),store:createTranslationStore(),
 sources:async()=>JSON.parse(await readFile(new URL('../build/translation-contracts/index.json',import.meta.url),'utf8')),
 source:async slug=>{const registry=JSON.parse(await readFile(new URL('../build/translation-contracts/index.json',import.meta.url),'utf8'));if(!registry.includes(slug))throw Error('Only published public contracts');return JSON.parse(await readFile(new URL('../build/translation-contracts/'+slug+'.json',import.meta.url),'utf8'));},
 glossary:async()=>JSON.parse(await readFile(new URL('../web/vercel/translation-glossary.json',import.meta.url),'utf8'))
});
export const GET=handlers.GET;export const POST=handlers.POST;
