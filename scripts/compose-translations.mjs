// Compose per-locale translation scratch files from unique-string maps.
// Usage: node scripts/compose-translations.mjs <slug> <mapsDir> <outDir>
// Maps: <mapsDir>/map-<locale>.json { sourceText: translatedText }; unmapped -> identity.
// Apostrophe variants (’/') are normalized on lookup. Warns on map keys not in the contract.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { loadContracts } from './translation-contracts.mjs';

const slug = process.argv[2], mapsDir = process.argv[3], outDir = process.argv[4];
if (!slug || !mapsDir || !outDir) { console.error('usage: compose-translations.mjs <slug> <mapsDir> <outDir>'); process.exit(1); }
const { contracts } = await loadContracts();
const contract = contracts.get(slug);
if (!contract) { console.error('unknown slug', slug); process.exit(1); }
const fallbacks = JSON.parse(await readFile(join(mapsDir, 'fallbacks.json'), 'utf8'));
const LOCALES = ['zh-Hans', 'es', 'hi', 'ar', 'fr', 'ja'];
const norm = (s) => s.replace(/\u2019/g, "'");
const texts = new Set(contract.segments.map((s) => s.text));
for (const locale of LOCALES) {
  const raw = await readFile(join(mapsDir, `map-${locale}.json`), 'utf8').catch(() => null);
  if (!raw) { console.log(`[skip] ${locale}: no map`); continue; }
  const map = JSON.parse(raw);
  const normMap = new Map(Object.entries(map).map(([k, v]) => [norm(k), v]));
  for (const key of Object.keys(map)) if (!texts.has(key) && !texts.has(key.replace(/'/g, '\u2019'))) console.warn(`[warn] ${locale} key not in contract: ${key.slice(0, 90)}`);
  const value = { locale, fallbackLabel: fallbacks[locale], segments: contract.segments.map((s) => ({ id: s.id, text: map[s.text] ?? normMap.get(norm(s.text)) ?? s.text })) };
  const out = join(outDir, `${locale}-${slug}.json`);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(value));
  console.log(`[ok] ${locale}/${slug}: ${value.segments.length} segments -> ${out}`);
}