import {readFile} from 'node:fs/promises';

export function validateNewsletterCatalog(items,routes) {
 if(!Array.isArray(items)||items.length>1000||!routes||typeof routes!=='object'||Array.isArray(routes)||Object.keys(routes).length>5000)throw Error('Public catalog unavailable');
 const stories=[],seen=new Set();
 for(const item of items) {
  if(item?.status!=='published')continue;
  if(typeof item.slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)||item.slug.length>100)throw Error('Invalid public story');
  if(!Object.hasOwn(routes,`/${item.slug}`))continue;
  if(routes[`/${item.slug}`]!==`${item.slug}.html`||seen.has(item.slug)||typeof item.title!=='string'||!item.title.trim()||item.title.length>400)throw Error('Invalid public story');
  if(typeof item.publishedAt!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(item.publishedAt)||!Number.isFinite(Date.parse(item.publishedAt))||new Date(item.publishedAt).toISOString().slice(0,10)!==item.publishedAt)throw Error('Invalid public date');
  for(const field of ['description','summary'])if(item[field]!==undefined&&(typeof item[field]!=='string'||item[field].length>4000))throw Error('Invalid public description');
  seen.add(item.slug);
  stories.push({slug:item.slug,title:item.title,status:'published',publishedAt:item.publishedAt,...(item.description!==undefined?{description:item.description}:{}),...(item.summary!==undefined?{summary:item.summary}:{})});
 }
 return stories;
}
export async function readNewsletterCatalog() {
 const values=await Promise.all(['articles','routes'].map(async name=>{
  const bytes=await readFile(new URL(`../web/vercel/${name}.json`,import.meta.url));
  if(bytes.byteLength>2000000)throw Error('Public catalog too large');
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }));
 return validateNewsletterCatalog(...values);
}
