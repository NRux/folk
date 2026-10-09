import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {publishedArticles} from './public-articles.mjs';
import {publicUiPages} from './translations.mjs';
const output=process.argv[2];if(!output)throw Error('Usage: node scripts/extract-translations.mjs <output-directory>');
const routes=JSON.parse(await readFile('web/vercel/routes.json','utf8')),catalog=JSON.parse(await readFile('web/vercel/articles.json','utf8'));
const articles=publishedArticles(catalog,routes),allowed=new Set([...articles.map(a=>a.slug),...Object.keys(publicUiPages(articles,routes)),'ui-messages']);
const index=JSON.parse(await readFile('build/translation-contracts/index.json','utf8'));
if(!Array.isArray(index)||index.length!==allowed.size||new Set(index).size!==index.length||index.some(slug=>!allowed.has(slug)))throw Error('Rebuild public translation registry');
const target=resolve(output);if(target===resolve('dist')||target.startsWith(resolve('dist')+'/')||target===resolve('web/vercel')||target.startsWith(resolve('web/vercel')+'/'))throw Error('Export outside public output and templates');
await mkdir(target,{recursive:true});
for(const slug of index){const contract=JSON.parse(await readFile(`build/translation-contracts/${slug}.json`,'utf8'));if(contract.slug!==slug||contract.format!=='folkly-public-segments-v1')throw Error('Rebuild translation contracts');await writeFile(resolve(target,`${slug}.json`),JSON.stringify(contract,null,2)+'\n',{flag:'wx'});}
console.log(`Extracted ${articles.length} stories and ${index.length-articles.length} shared UI contracts; no provider calls or locale publication.`);
