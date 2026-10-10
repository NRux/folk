// Compose per-locale translation scratch files by merging unique-string maps.
// Usage: node scripts/compose-translations.mjs <slug> <outDir> <mapDir1> [<mapDir2> ...]
// Precedence: later dirs override earlier. Unmapped keys pass through as identity.
// Each mapDir may contain map-<locale>.json ({ sourceText: translatedText }) and an
// optional fallbacks.json ({ locale: label }); the first fallbacks.json found wins.
// Reports per-locale how many segments stayed identical (untranslated).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { loadContracts } from './translation-contracts.mjs';

const slug = process.argv[2], outDir = process.argv[3];
const mapDirs = process.argv.slice(4);
if (!slug || !outDir || !mapDirs.length) { console.error('usage: compose-translations.mjs <slug> <outDir> <mapDir>...'); process.exit(1); }
const { contracts } = await loadContracts();
const contract = contracts.get(slug);
if (!contract) { console.error('unknown slug', slug); process.exit(1); }
const LOCALES = ['zh-Hans', 'es', 'hi', 'ar', 'fr', 'ja'];
const norm = (s) => s.replace(/\u2019/g, "'");
let fallbacks = {};
for (const dir of mapDirs) {
  const raw = await readFile(join(dir, 'fallbacks.json'), 'utf8').catch(() => null);
  if (raw) { fallbacks = JSON.parse(raw); break; }
}
for (const locale of LOCALES) {
  const map = {};
  for (const dir of mapDirs) {
    const raw = await readFile(join(dir, `map-${locale}.json`), 'utf8').catch(() => null);
    if (!raw) continue;
    for (const [k, v] of Object.entries(JSON.parse(raw))) if (!(k in map)) map[k] = v;
  }
  const normMap = new Map(Object.entries(map).map(([k, v]) => [norm(k), v]));
  const byId = new Map(contract.segments.map((s) => [s.id, s.text]));
  const segs = contract.segments.map((s) => ({ id: s.id, text: map[s.text] ?? normMap.get(norm(s.text)) ?? s.text }));
  let identity = 0;
  for (const s of segs) if (s.text === byId.get(s.id)) identity++;
  const value = { locale, fallbackLabel: fallbacks[locale] ?? '', segments: segs };
  const out = join(outDir, `${locale}-${slug}.json`);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(value));
  console.log(`[ok] ${locale}/${slug}: ${segs.length} segments (${identity} untranslated) -> ${out}`);
}