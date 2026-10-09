import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {extractContract,extractUiContract,messageContract,translatedMessages,attachMessages,UI_PAGES,pagePath,validateManifest,reviewedTranslations,renderTranslation,decorateEnglish} from './translations.mjs';

export async function buildTranslations({articles,origin}){
  const manifest=JSON.parse(await readFile('web/vercel/translation-manifest.json','utf8'));
  if(manifest.format!=='folkly-translation-manifest-v1'||Object.keys(manifest).sort().join('|')!=='entries|format')throw Error('Invalid translation manifest');
  const glossary=JSON.parse(await readFile('web/vercel/translation-glossary.json','utf8')),releases=JSON.parse(await readFile('web/vercel/manual-releases.json','utf8'));
  const contracts=new Map(),templates=new Map(),translations=new Map();
  for(const article of articles){const html=await readFile(`dist/${article.slug}.html`,'utf8');templates.set(article.slug,html);contracts.set(article.slug,extractContract(html,{slug:article.slug,glossary,manifest:releases,catalog:articles}));}
  for(const [slug,page] of Object.entries(UI_PAGES)){let html;try{html=await readFile('dist/'+page.file,'utf8');}catch(error){if(error.code==='ENOENT')continue;throw error;}templates.set(slug,html);contracts.set(slug,extractUiContract(html,{slug,glossary}));}
  contracts.set('ui-messages',messageContract(glossary));
  // Validate identities and approval before using entries as filesystem paths.
  const safeEntries=validateManifest(manifest.entries,contracts);
  for(const entry of safeEntries){
    translations.set(`${entry.locale}/${entry.slug}`,JSON.parse(await readFile(`web/vercel/translations/${entry.locale}/${entry.slug}.json`,'utf8')));
  }
  const approved=reviewedTranslations(safeEntries,contracts,translations),paths=[];
  // Nonpublic build artifacts provide a stable export even after locale navigation is added.
  await mkdir('build/translation-contracts',{recursive:true});
  for(const [slug,contract] of contracts)await writeFile(`build/translation-contracts/${slug}.json`,JSON.stringify(contract,null,2)+'\n');
  await writeFile('build/translation-contracts/index.json',JSON.stringify([...contracts.keys()].sort())+'\n');
  for(const [key,value] of approved){
   if(value.slug==='ui-messages')continue;
   const contract=contracts.get(value.slug),path=pagePath(value.slug,value.locale),target=`dist${path}.html`;
   let html=renderTranslation(templates.get(value.slug),value,contract,approved,origin);
   const messages=approved.get(value.locale+'/ui-messages');if(messages)html=attachMessages(html,value.locale,translatedMessages(messages,contracts.get('ui-messages')));
   await mkdir(`dist/${value.locale}`,{recursive:true});await writeFile(target,html);paths.push(path);
  }
  for(const [slug,html] of templates)await writeFile(`dist/${Object.hasOwn(UI_PAGES,slug)?UI_PAGES[slug].file:slug+'.html'}`,decorateEnglish(html,slug,approved,origin));
  for(const file of ['locales.css','language.js','reader-ui.js']){try{await cp(`web/vercel/${file}`,`dist/${file}`);}catch(error){if(error.code!=='ENOENT'||file!=='reader-ui.js')throw error;}}
  if(paths.length){let sitemap=await readFile('dist/sitemap.xml','utf8');sitemap=sitemap.replace('</urlset>',paths.map(path=>`<url><loc>${origin}${path}</loc></url>`).join('')+'</urlset>');await writeFile('dist/sitemap.xml',sitemap);}
  return {contracts,approved};
}
