import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {publishedArticles} from './public-articles.mjs';
const output=process.argv[2];if(!output)throw Error('Usage: node scripts/extract-translations.mjs <output-directory>');
const routes=JSON.parse(await readFile('web/vercel/routes.json','utf8')),catalog=JSON.parse(await readFile('web/vercel/articles.json','utf8'));
const articles=publishedArticles(catalog,routes);await mkdir(resolve(output),{recursive:true});
for(const article of articles){const contract=JSON.parse(await readFile(`build/translation-contracts/${article.slug}.json`,'utf8'));if(contract.slug!==article.slug||contract.format!=='folkly-public-segments-v1')throw Error('Rebuild translation contracts');await writeFile(resolve(output,`${article.slug}.json`),JSON.stringify(contract,null,2)+'\n',{flag:'wx'});}
console.log(`Extracted ${articles.length} public-only contracts; no provider calls or locale publication.`);
