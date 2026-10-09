import {createHash} from 'node:crypto';
import {escapeHtml} from './public-articles.mjs';

export const LOCALES=Object.freeze({en:'English','zh-Hans':'简体中文',es:'Español',hi:'हिन्दी',ar:'العربية',fr:'Français',ja:'日本語'});
export const TRANSLATION_PROMPT_VERSION='faithful-public-segments-v1';
export const UI_PAGES=Object.freeze({'ui-home':{path:'/',file:'index.html'},'ui-archive':{path:'/archive',file:'archive.html'},'ui-about':{path:'/about',file:'about.html'},'ui-subscribe':{path:'/subscribe',file:'subscribe.html'},'ui-privacy':{path:'/privacy',file:'privacy.html'},'ui-image-credits':{path:'/image-credits',file:'image-credits.html'}});
export const PUBLIC_MESSAGES=Object.freeze({count:'Showing {shown} of {total} {noun}',story:'story',stories:'stories',gpc:'Global Privacy Control detected. Advertising stays disabled; analytics is a separate optional choice.',contactSaving:'Saving your message…',contactSaved:'Thank you. Your message has been saved for Folkly.',contactInvalid:'Check your name, email, reason, message and consent, then try again.',contactUnavailable:'Contact is temporarily unavailable. Please try again later.',contactConnection:'Could not connect. Your message has not been confirmed saved. Please try again.',subscribeSaving:'Saving your subscription…',subscribeSaved:'Thank you. Your subscription has been saved.',subscribeInvalid:'Check your email address and consent, then try again.',subscribeUnavailable:'Subscription is temporarily unavailable. Please try again later.',subscribeConnection:'Could not connect. Please try again.'});
export const pagePath=(slug,locale='en')=>{const path=Object.hasOwn(UI_PAGES,slug)?UI_PAGES[slug].path:`/${slug}`;return locale==='en'?path:`/${locale}${path==='/'?'':path}`;};
export const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===keys.slice().sort().join('|');
const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“',middot:'·',larr:'←',mdash:'—',ndash:'–'};
function plain(value){return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,(all,key)=>{
  if(key[0]==='#'){const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));if(!Number.isSafeInteger(n)||n<1||n>0x10ffff||n>=0xd800&&n<=0xdfff)throw Error('Invalid source entity');return String.fromCodePoint(n);}
  if(!(key in entities))throw Error('Unknown source entity');return entities[key];
});}
const attrs=tag=>Object.fromEntries([...tag.matchAll(/\s([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const voidTags=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);

// Source is trusted build output. Models receive plain segments, never this template.
function ranges(html){
  const stack=[],found=[];let count=0;
  const tokens=/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-zA-Z][^>]*>|[^<]+|</g;
  const skipped=()=>stack.some(t=>['script','style','noscript','code','sup'].includes(t.name)||t.a.id==='sources'||/\bbyline\b/.test(t.a.class||'')||t.name==='a'&&stack.some(p=>p.name==='figcaption')||t.name==='small'&&stack.some(p=>/\brelated-stories\b/.test(p.a.class||''))||t.a.class==='grid-credit');
  const push=(start,end,kind,text)=>{if(text.trim())found.push({id:`s${String(++count).padStart(4,'0')}`,start,end,kind,text:plain(text)});};
  for(const match of html.matchAll(tokens)){
    const token=match[0],start=match.index;
    if(token.startsWith('<!'))continue;
    if(token.startsWith('</')){const name=token.match(/^<\/([\w-]+)/)[1].toLowerCase(),i=stack.map(t=>t.name).lastIndexOf(name);if(i>=0)stack.splice(i);continue;}
    if(token.startsWith('<')){
      const name=token.match(/^<([\w-]+)/)?.[1]?.toLowerCase();if(!name)throw Error('Unsupported source markup');
      const a=attrs(token);
      if(!skipped())for(const attribute of ['alt','aria-label','placeholder','data-title',...(name==='optgroup'?['label']:[]),...(name==='meta'&&(['description'].includes(a.name)||['og:title','og:description','og:image:alt'].includes(a.property))?['content']:[])]){
        const m=token.match(new RegExp(`\\s${attribute}="([^"]*)"`));if(m){const offset=m.index+m[0].indexOf('"')+1;push(start+offset,start+offset+m[1].length,attribute,m[1]);}
      }
      if(!voidTags.has(name)&&!token.endsWith('/>'))stack.push({name,a});continue;
    }
    if(!skipped()){
      // Attribution marker and credited names/licenses remain immutable.
      const caption=stack.some(t=>t.name==='figcaption');
      if(caption&&/^[\s/.]*$/.test(token))continue;
      const end=caption?token.search(/\b(?:Photo|Image):/):-1;
      const value=end>=0?token.slice(0,end):token;
      const trimmed=value.trim();if(trimmed){const offset=value.indexOf(trimmed);push(start+offset,start+offset+trimmed.length,stack.at(-1)?.name||'text',trimmed);}
    }
  }
  return found;
}

export function extractContract(html,{slug,status='published',glossary,manifest,catalog}={}){
  if(status!=='published'||slug?.startsWith('ui-')||!catalog?.some(a=>a.slug===slug&&a.status==='published')||! /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw Error('Only catalogued public stories can be translated');
  if(manifest?.articles?.some(a=>a.slug===slug)&&!manifest.articles.find(a=>a.slug===slug).contentHash)throw Error('Missing release provenance');
  const segments=ranges(html).map(({id,kind,text})=>({id,kind,text}));
  if(!segments.length)throw Error('Empty translation source');
  return {format:'folkly-public-segments-v1',slug,sourceHash:hash(html),glossaryHash:hash(glossary),promptVersion:TRANSLATION_PROMPT_VERSION,segments,
    immutable:{links:[...html.matchAll(/\bhref="([^"]*)"/g)].map(m=>m[1]),media:[...html.matchAll(/\bdata-image-id="([^"]*)"/g)].map(m=>m[1])}};
}

export function extractUiContract(html,{slug,glossary}){
 if(!Object.hasOwn(UI_PAGES,slug))throw Error('Unknown or private UI source');
 return {format:'folkly-public-segments-v1',slug,sourceHash:hash(html),glossaryHash:hash(glossary),promptVersion:TRANSLATION_PROMPT_VERSION,segments:ranges(html).map(({id,kind,text})=>({id,kind,text})),immutable:{links:[...html.matchAll(/\bhref="([^"]*)"/g)].map(m=>m[1]),media:[...html.matchAll(/\bdata-image-id="([^"]*)"/g)].map(m=>m[1])}};
}
export function messageContract(glossary){return {format:'folkly-public-segments-v1',slug:'ui-messages',sourceHash:hash(PUBLIC_MESSAGES),glossaryHash:hash(glossary),promptVersion:TRANSLATION_PROMPT_VERSION,segments:Object.entries(PUBLIC_MESSAGES).map(([kind,text],i)=>({id:`s${String(i+1).padStart(4,'0')}`,kind,text})),immutable:{links:[],media:[]}};}
export function translatedMessages(value,contract){validateTranslation(value,contract);if(contract.slug!=='ui-messages')throw Error('Message source required');return Object.fromEntries(contract.segments.map((segment,i)=>[segment.kind,value.segments[i].text]));}

export function validateTranslation(value,contract){
  if(!exact(value,['format','slug','locale','sourceHash','glossaryHash','promptVersion','fallbackLabel','segments'])||value.format!=='folkly-translation-v1'||!Object.hasOwn(LOCALES,value.locale)||value.locale==='en')throw Error('Invalid translation contract');
  for(const k of ['slug','sourceHash','glossaryHash','promptVersion'])if(value[k]!==contract[k])throw Error('Stale translation contract');
  const safe=text=>typeof text==='string'&&text.trim()&&Buffer.byteLength(text)<=30000&&!/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text);
  if(!safe(value.fallbackLabel)||!Array.isArray(value.segments)||value.segments.length!==contract.segments.length)throw Error('Missing translation segments');
  value.segments.forEach((segment,i)=>{if(!exact(segment,['id','text'])||segment.id!==contract.segments[i].id||!safe(segment.text))throw Error('Invalid translation segment');const placeholders=text=>(text.match(/\{[a-z]+\}/g)||[]).sort().join('|');if(placeholders(segment.text)!==placeholders(contract.segments[i].text))throw Error('Translation placeholders changed');});
  return value;
}

export function validateManifest(entries,contracts){
  if(!Array.isArray(entries)||entries.length>1000)throw Error('Invalid translation manifest');
  const current=[],seen=new Set();
  for(const entry of entries){
    if(!exact(entry,['slug','locale','status','sourceHash','glossaryHash','promptVersion','translationHash','review'])||! /^[a-f0-9]{64}$/.test(entry.translationHash)||!['draft','approved','stale'].includes(entry.status)||!Object.hasOwn(LOCALES,entry.locale)||entry.locale==='en'||! /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug))throw Error('Invalid manifest entry');
    const key=`${entry.locale}/${entry.slug}`;if(seen.has(key))throw Error('Duplicate translation identity');seen.add(key);
    const source=contracts.get(entry.slug);if(!source)throw Error('Private or unknown translation story');
    if(entry.status!=='approved'||['sourceHash','glossaryHash','promptVersion'].some(k=>entry[k]!==source[k]))continue;
    if(!exact(entry.review,['reviewer','reviewedAt','competentLanguageReview'])||typeof entry.review.reviewer!=='string'||!entry.review.reviewer.trim()||entry.review.competentLanguageReview!==true||!/^\d{4}-\d{2}-\d{2}T/.test(entry.review.reviewedAt)||!Number.isFinite(Date.parse(entry.review.reviewedAt)))throw Error('Missing language review');
    current.push(entry);
  }
  return current;
}
export function reviewedTranslations(entries,contracts,translations){
  const approved=new Map();
  for(const entry of validateManifest(entries,contracts)){
    const key=`${entry.locale}/${entry.slug}`,value=translations.get(key);
    validateTranslation(value,contracts.get(entry.slug));if(value.locale!==entry.locale||hash(value)!==entry.translationHash)throw Error('Translation changed after review');approved.set(key,value);
  }
  return approved;
}

export function alternateLinks(slug,approved,origin){
  const paths=[['en',pagePath(slug)],...Object.keys(LOCALES).filter(l=>l!=='en'&&approved.has(`${l}/${slug}`)).map(l=>[l,pagePath(slug,l)]),['x-default',pagePath(slug)]];
  return paths.map(([locale,path])=>`<link rel="alternate" hreflang="${locale}" href="${escapeHtml(origin+path)}">`).join('');
}
export function languageSelector(slug,locale,approved){
  const available=Object.keys(LOCALES).filter(l=>l==='en'||approved.has(`${l}/${slug}`));if(available.length===1)return '';
  return `<nav class="language-switcher" aria-label="${escapeHtml(LOCALES[locale])}">${available.map(l=>`<a lang="${l}" hreflang="${l}" href="${pagePath(slug,l)}"${l===locale?' aria-current="page"':''}>${LOCALES[l]}</a>`).join('')}</nav>`;
}
export function decorateEnglish(html,slug,approved,origin){
  if(!Object.keys(LOCALES).some(l=>approved.has(`${l}/${slug}`)))return html;
  return html.replace('</head>',`${alternateLinks(slug,approved,origin)}<link rel="stylesheet" href="/locales.css"><script defer src="/language.js"></script></head>`).replace('<main ',`${languageSelector(slug,'en',approved)}<main `);
}
export function renderTranslation(html,value,contract,approved,origin){
  validateTranslation(value,contract);if(hash(html)!==contract.sourceHash)throw Error('Source template changed');
  const list=ranges(html);if(list.length!==value.segments.length)throw Error('Segment coverage changed');
  let output=html;for(let i=list.length-1;i>=0;i--)output=output.slice(0,list[i].start)+escapeHtml(value.segments[i].text)+output.slice(list[i].end);
  const locale=value.locale,url=origin+pagePath(contract.slug,locale);
  output=output.replace(/<html\b[^>]*>/,`<html lang="${locale}" dir="${locale==='ar'?'rtl':'ltr'}">`).replace(/<link rel="canonical" href="[^"]*">/,`<link rel="canonical" href="${url}">`).replace(/<meta property="og:url" content="[^"]*">/,`<meta property="og:url" content="${url}">`);
  const title=plain(output.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1]?.replace(/<[^>]*>/g,'')||''),summary=plain(output.match(/<meta name="description" content="([^"]*)">/)?.[1]||'');
  output=output.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,(match,raw)=>{const data=JSON.parse(raw);if(data['@type']!=='Article')return match;data.url=url;data.mainEntityOfPage=url;data.inLanguage=locale;data.headline=title;data.description=summary;delete data.wordCount;return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g,'\\u003c')}</script>`;});
  let fallback=false;
  output=output.replace(/<a\b([^>]*?)href="(\/[^"]*)"([^>]*)>/g,(match,before,path,after)=>{
    if(path.startsWith('/api/'))return match;
    const [base,fragment]=path.split('#'),ui=Object.keys(UI_PAGES).find(key=>UI_PAGES[key].path===base),slug=ui||base.slice(1);
    if(approved.has(`${locale}/${slug}`))return `<a${before}href="${pagePath(slug,locale)}${fragment?'#'+fragment:''}"${after}>`;
    fallback=true;
    return `<a${before.replace(/\s(?:lang|title|aria-describedby)="[^"]*"/g,'')}href="${path}"${after.replace(/\s(?:lang|title|aria-describedby)="[^"]*"/g,'')} hreflang="en" title="${escapeHtml(value.fallbackLabel)}" aria-describedby="locale-fallback">`;
  });
  // Source templates may use root-relative shorthand; locale directories must not change asset resolution.
  output=output.replace(/\b(src|href)="(assets\/[^\"]*)"/g,'$1="/$2"');
  const notice=fallback?`<p class="language-fallback" id="locale-fallback">${escapeHtml(value.fallbackLabel)}</p>`:'';
  return output.replace('</head>',`${alternateLinks(contract.slug,approved,origin)}<link rel="stylesheet" href="/locales.css"><script defer src="/language.js"></script></head>`).replace('<main ',`${languageSelector(contract.slug,locale,approved)}${notice}<main `);
}

export function attachMessages(html,locale,messages){
 const encoded=JSON.stringify({locale,strings:messages}).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
 return html.replace('<head>',`<head><script type="application/json" id="folkly-reader-ui">${encoded}</script><script defer src="/reader-ui.js"></script>`);
}
