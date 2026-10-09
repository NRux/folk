// Generate translation DRAFTS for every public source x locale using the local
// Ollama provider. Same contract, system prompt and validation gates as the
// hosted pipeline (server/translation-jobs.js); drafts are stored exactly where
// the manifest/blob system expects them and are NOT released:
//   repo:    web/vercel/translations/<locale>/<slug>.json (+ manifest, status 'draft')
//   private: <out>/editorial/translations/<content-checksum>.json  (Blob layout)
// Release requires the owner's competent-language review (manifest -> approved).
// Usage: node scripts/generate-translation-drafts.mjs [--from N] [--only slug,slug]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import http from 'node:http';
import { LOCALES, validateTranslation, hash, publicUiPages, extractContract, extractUiContract, messageContract } from './translations.mjs';
import { TRANSLATION_SYSTEM } from '../server/translation-jobs.js';
import { publishedArticles } from './public-articles.mjs';

const ROOT = process.cwd();
const PRIVATE_DIR = process.env.FOLKLY_PRIVATE_OUT || join(ROOT, '..', 'folkly-private');
const OLLAMA = process.env.FOLKLY_LLM_BASE_URL || 'http://127.0.0.1:11434';
const MODEL = process.env.FOLKLY_LLM_MODEL || 'qwen3.8:latest';
const LOCALE_KEYS = Object.keys(LOCALES).filter((l) => l !== 'en');
const CHUNK_BYTES = 24000; // segment text per model call; output fits num_predict
const MAX_ATTEMPTS = 3;

const nowIso = () => new Date().toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Native Ollama streaming chat (idle-timeout safe; tokens keep the socket alive).
function ollamaChat(messages, { schema, numPredict = 16384, timeoutMs = 900000 } = {}) {
  const u = new URL(OLLAMA);
  const body = JSON.stringify({ model: MODEL, messages, stream: true, think: false, format: schema, options: { num_ctx: 32768, num_predict: numPredict, temperature: 0.2 } });
  return new Promise((resolve, reject) => {
    const req = http.request({ method: 'POST', hostname: u.hostname, port: u.port, path: u.pathname.replace(/\/$/, '') + '/api/chat', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
      if (res.statusCode >= 400) { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => reject(new Error('Ollama HTTP ' + res.statusCode + ': ' + b.slice(0, 200)))); return; }
      let buf = '', content = '', usage = null;
      const onLine = (line) => { line = line.trim(); if (!line) return; let j; try { j = JSON.parse(line); } catch { return; } if (j.message?.content) content += j.message.content; if (j.eval_count != null || j.prompt_eval_count != null) usage = { input: j.prompt_eval_count || 0, output: j.eval_count || 0 }; };
      res.on('data', (c) => { buf += c.toString('utf8'); let nl; while ((nl = buf.indexOf('\n')) >= 0) { onLine(buf.slice(0, nl)); buf = buf.slice(nl + 1); } });
      res.on('end', () => { if (buf.trim()) onLine(buf); resolve({ text: content, usage }); });
      res.setTimeout(timeoutMs, () => req.destroy(new Error('Ollama stream idle timeout')));
    });
    req.on('error', reject); req.write(body); req.end();
  });
}

const segmentSchema = { type: 'object', properties: { segments: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } }, required: ['id', 'text'], additionalProperties: false } } }, required: ['segments'], additionalProperties: false };

async function callWithRetry(messages, opts) {
  let last;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { text, usage } = await ollamaChat(messages, opts);
      return { parsed: JSON.parse(text), usage };
    } catch (e) { last = e; console.log(`   attempt ${attempt} failed: ${String(e.message).slice(0, 120)}`); await sleep(3000 * attempt); }
  }
  throw last;
}

async function translateChunk(locale, contract, segments, glossary) {
  const messages = [
    { role: 'system', content: TRANSLATION_SYSTEM },
    { role: 'user', content: JSON.stringify({ locale, slug: contract.slug, glossary, segments }) },
  ];
  const { parsed, usage } = await callWithRetry(messages, { schema: segmentSchema });
  const out = parsed?.segments;
  if (!Array.isArray(out) || out.length !== segments.length) throw new Error(`chunk segment count ${Array.isArray(out) ? out.length : 'n/a'} != ${segments.length}`);
  const byId = new Map();
  for (const s of out) { if (!s || typeof s.id !== 'string' || typeof s.text !== 'string' || !s.text.trim()) throw new Error('invalid chunk segment'); if (byId.has(s.id)) throw new Error('duplicate segment ' + s.id); byId.set(s.id, s); }
  return { segments: segments.map((s) => { const hit = byId.get(s.id); if (!hit) throw new Error('missing segment ' + s.id); return { id: s.id, text: hit.text }; }), usage };
}

// ---- contracts (same derivation as buildTranslations) ----
const routes = JSON.parse(await readFile(join(ROOT, 'web/vercel/routes.json'), 'utf8'));
const catalog = JSON.parse(await readFile(join(ROOT, 'web/vercel/articles.json'), 'utf8'));
const glossary = JSON.parse(await readFile(join(ROOT, 'web/vercel/translation-glossary.json'), 'utf8'));
const releases = JSON.parse(await readFile(join(ROOT, 'web/vercel/manual-releases.json'), 'utf8'));
const articles = publishedArticles(catalog, routes);
const pages = publicUiPages(articles, routes);
const contracts = new Map();
for (const a of articles) contracts.set(a.slug, extractContract(await readFile(join(ROOT, 'dist', a.slug + '.html'), 'utf8'), { slug: a.slug, status: 'published', glossary, manifest: releases, catalog }));
for (const [slug, page] of Object.entries(pages)) contracts.set(slug, extractUiContract(await readFile(join(ROOT, 'dist', page.file), 'utf8'), { slug, glossary, pages }));
contracts.set('ui-messages', messageContract(glossary));

// Priority: articles -> core UI -> messages -> discovery/author pages
const coreUi = ['ui-home', 'ui-archive', 'ui-about', 'ui-subscribe', 'ui-privacy', 'ui-image-credits'];
const order = [...articles.map((a) => a.slug), ...coreUi, 'ui-messages', ...[...contracts.keys()].filter((s) => !articles.some((a) => a.slug === s) && !coreUi.includes(s) && s !== 'ui-messages')];
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const work = order.filter((s) => (!only || only.includes(s)) && contracts.has(s));

// ---- fallback label per locale (one call each, reused across contracts) ----
const fallbackPath = join(PRIVATE_DIR, 'fallback-labels.json');
let fallbacks = existsSync(fallbackPath) ? JSON.parse(await readFile(fallbackPath, 'utf8')) : {};
for (const locale of LOCALE_KEYS) {
  if (fallbacks[locale]) continue;
  const { parsed } = await callWithRetry([
    { role: 'system', content: 'Translate the supplied sentence faithfully. Output JSON {"label": "..."} with the translation only.' },
    { role: 'user', content: JSON.stringify({ sentence: 'This page is also available in English.', target_language: LOCALES[locale] }) },
  ], { schema: { type: 'object', properties: { label: { type: 'string' } }, required: ['label'] }, numPredict: 200 });
  fallbacks[locale] = String(parsed.label).trim();
  await mkdir(dirname(fallbackPath), { recursive: true }); await writeFile(fallbackPath, JSON.stringify(fallbacks, null, 2));
}
console.log(`[run] fallback labels: ${LOCALE_KEYS.map((l) => l + '=' + fallbacks[l]).join(' | ')}`);

// ---- manifest ----
const manifestPath = join(ROOT, 'web/vercel/translation-manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const manifestKey = (e) => e.locale + '/' + e.slug;

// ---- main loop ----
let done = 0, skipped = 0, failed = 0;
const usageLog = [];
const runStart = Date.now();
for (const slug of work) {
  const contract = contracts.get(slug);
  for (const locale of LOCALE_KEYS) {
    const target = join(ROOT, 'web/vercel/translations', locale, slug + '.json');
    const tag = `${locale}/${slug}`;
    if (existsSync(target)) {
      try { validateTranslation(JSON.parse(await readFile(target, 'utf8')), contract); skipped++; continue; } catch { /* regenerate */ }
    }
    process.stdout.write(`[run ${done + 1}/${work.length * LOCALE_KEYS.length}] ${tag} (${contract.segments.length} segments) ... `);
    try {
      // chunk by bytes
      const chunks = []; let cur = [], curBytes = 0;
      for (const s of contract.segments) { const b = Buffer.byteLength(JSON.stringify(s)); if (curBytes + b > CHUNK_BYTES && cur.length) { chunks.push(cur); cur = []; curBytes = 0; } cur.push(s); curBytes += b; }
      if (cur.length) chunks.push(cur);
      const segments = []; let inputTokens = 0, outputTokens = 0;
      for (const chunk of chunks) {
        const r = await translateChunk(locale, contract, chunk, glossary);
        segments.push(...r.segments); inputTokens += r.usage?.input || 0; outputTokens += r.usage?.output || 0;
      }
      if (segments.length !== contract.segments.length) throw new Error('segment total mismatch');
      const value = { format: 'folkly-translation-v1', slug, locale, sourceHash: contract.sourceHash, glossaryHash: contract.glossaryHash, promptVersion: contract.promptVersion, fallbackLabel: fallbacks[locale], segments };
      validateTranslation(value, contract); // the real gate
      const serialized = JSON.stringify(value);
      await mkdir(dirname(target), { recursive: true }); await writeFile(target, serialized);
      // private Blob-layout staging copy (editorial/translations/<content-checksum>.json)
      const checksum = hash(value);
      const blobPath = join(PRIVATE_DIR, 'editorial', 'translations', checksum + '.json');
      await mkdir(dirname(blobPath), { recursive: true }); await writeFile(blobPath, serialized);
      // manifest draft entry (never approved; owner review flips status)
      const entry = { slug, locale, status: 'draft', sourceHash: contract.sourceHash, glossaryHash: contract.glossaryHash, promptVersion: contract.promptVersion, translationHash: checksum, review: { reviewer: null, reviewedAt: null, competentLanguageReview: false, note: 'machine draft via local provider; pending owner competent-language review' } };
      const idx = manifest.entries.findIndex((e) => manifestKey(e) === tag);
      if (idx >= 0) manifest.entries[idx] = entry; else manifest.entries.push(entry);
      manifest.entries.sort((a, b) => manifestKey(a).localeCompare(manifestKey(b)));
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
      usageLog.push({ locale, slug, inputTokens, outputTokens, translationHash: checksum, at: nowIso() });
      done++;
      console.log(`ok (${chunks} chunk${chunks.length > 1 ? 's' : ''}, ${inputTokens}/${outputTokens} tok)`);
    } catch (e) {
      failed++;
      console.log('FAILED: ' + String(e.message).slice(0, 200));
      await mkdir(join(PRIVATE_DIR, 'translations-run'), { recursive: true });
      await writeFile(join(PRIVATE_DIR, 'translations-run', 'failed.json'), JSON.stringify({ tag, error: String(e.message).slice(0, 500), at: nowIso() }, null, 2) + '\n', { flag: 'a' });
    }
    await mkdir(join(PRIVATE_DIR, 'translations-run'), { recursive: true });
    await writeFile(join(PRIVATE_DIR, 'translations-run', 'usage.json'), JSON.stringify(usageLog, null, 2));
    await writeFile(join(PRIVATE_DIR, 'translations-run', 'progress.json'), JSON.stringify({ done, skipped, failed, total: work.length * LOCALE_KEYS.length, at: nowIso() }, null, 2));
  }
}
console.log(`\n[run] complete in ${Math.round((Date.now() - runStart) / 60000)} min: generated=${done} skipped(resumed)=${skipped} failed=${failed}`);
console.log(`[run] drafts: web/vercel/translations/* (manifest status 'draft'); blob-layout staging: ${join(PRIVATE_DIR, 'editorial', 'translations')}`);
console.log('[run] release requires owner competent-language review per locale (manifest status draft -> approved).');