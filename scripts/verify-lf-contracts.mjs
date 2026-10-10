// Simulates the Linux/Vercel build: contracts extracted from \r-stripped (LF)
// English dist HTML must match the manifest sourceHash for every entry.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { extractContract, extractUiContract, messageContract } from './translations.mjs';
import { publishedArticles } from './public-articles.mjs';
import { publicUiPages } from './translations.mjs';

const root = process.cwd();
const routes = JSON.parse(await readFile(join(root, 'web/vercel/routes.json'), 'utf8'));
const catalog = JSON.parse(await readFile(join(root, 'web/vercel/articles.json'), 'utf8'));
const glossary = JSON.parse(await readFile(join(root, 'web/vercel/translation-glossary.json'), 'utf8'));
const releases = JSON.parse(await readFile(join(root, 'web/vercel/manual-releases.json'), 'utf8'));
const articles = publishedArticles(catalog, routes);
const pages = publicUiPages(articles, routes);
const lf = (s) => s.replaceAll('\r', '');
const contracts = new Map();
for (const a of articles) contracts.set(a.slug, extractContract(lf(await readFile(join(root, 'dist', a.slug + '.html'), 'utf8')), { slug: a.slug, status: 'published', glossary, manifest: releases, catalog }));
for (const [slug, page] of Object.entries(pages)) contracts.set(slug, extractUiContract(lf(await readFile(join(root, 'dist', page.file), 'utf8')), { slug, glossary, pages }));
contracts.set('ui-messages', messageContract(glossary));
const manifest = JSON.parse(await readFile(join(root, 'web/vercel/translation-manifest.json'), 'utf8'));
let bad = 0;
for (const entry of manifest.entries) {
  if (entry.sourceHash !== contracts.get(entry.slug).sourceHash) { console.log(`MISMATCH ${entry.locale}/${entry.slug}`); bad++; }
}
console.log(bad === 0 ? `LF-simulated contracts match all ${manifest.entries.length} manifest entries` : `${bad} mismatches`);