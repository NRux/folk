import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {extractContract,validateManifest,reviewedTranslations,renderTranslation,decorateEnglish} from './translations.mjs';

export async function buildTranslations({articles,origin}){
  const manifest=JSON.parse(await readFile('web/vercel/translation-manifest.json','utf8'));
  if(manifest.format!=='folkly-translation-manifest-v1'||Object.keys(manifest).sort().join('|')!=='entries|format')throw Error('Invalid translation manifest');
  const glossary=JSON.parse(await readFile('web/vercel/translation-glossary.json','utf8')),releases=JSON.parse(await readFile('web/vercel/manual-releases.json','utf8'));
  const contracts=new Map(),templates=new Map(),translations=new Map();
  for(const article of articles){const html=await readFile(`dist/${article.slug}.html`,'utf8');templates.set(article.slug,html);contracts.set(article.slug,extractContract(html,{slug:article.slug,glossary,manifest:releases,catalog:articles}));}
  // Validate identities and approval before using entries as filesystem paths.
  const safeEntries=validateManifest(manifest.entries,contracts);
  for(const entry of safeEntries){
    translations.set(`${entry.locale}/${entry.slug}`,JSON.parse(await readFile(`web/vercel/translations/${entry.locale}/${entry.slug}.json`,'utf8')));
  }
  const approved=reviewedTranslations(safeEntries,contracts,translations),paths=[];
  // Nonpublic build artifacts provide a stable export even after locale navigation is added.
  await mkdir('build/translation-contracts',{recursive:true});
  for(const [slug,contract] of contracts)await writeFile(`build/translation-contracts/${slug}.json`,JSON.stringify(contract,null,2)+'\n');
  for(const [key,value] of approved){const contract=contracts.get(value.slug),target=`dist/${value.locale}/${value.slug}.html`;await mkdir(`dist/${value.locale}`,{recursive:true});await writeFile(target,renderTranslation(templates.get(value.slug),value,contract,approved,origin));paths.push(`/${key}`);}
  for(const [slug,html] of templates)await writeFile(`dist/${slug}.html`,decorateEnglish(html,slug,approved,origin));
  for(const file of ['locales.css','language.js'])await cp(`web/vercel/${file}`,`dist/${file}`);
  if(paths.length){let sitemap=await readFile('dist/sitemap.xml','utf8');sitemap=sitemap.replace('</urlset>',paths.map(path=>`<url><loc>${origin}${path}</loc></url>`).join('')+'</urlset>');await writeFile('dist/sitemap.xml',sitemap);}
  return {contracts,approved};
}
