// One-time migration: recompute manifest sourceHash/translationHash under the
// line-ending-stable sourceHash (strips \r before hashing the English template).
// The first manifests were recorded from a CRLF (git autocrlf) Windows dist, so
// LF-built Vercel contracts mismatched and reviewedTranslations skipped every
// entry. This rewrites each installed translation's embedded sourceHash and the
// manifest's sourceHash/translationHash to the stable values; statuses, reviews
// and segment text are untouched.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadContracts } from './translation-contracts.mjs';
import { hash } from './translations.mjs';

const root = process.cwd();
const { contracts } = await loadContracts(root);
const manifestPath = join(root, 'web/vercel/translation-manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
let updated = 0;
for (const entry of manifest.entries) {
  const contract = contracts.get(entry.slug);
  if (!contract) throw new Error(`no contract for ${entry.slug}`);
  const file = join(root, 'web/vercel/translations', entry.locale, `${entry.slug}.json`);
  let value;
  try {
    value = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    throw new Error(`missing translation file: ${entry.locale}/${entry.slug}`);
  }
  value.sourceHash = contract.sourceHash;
  entry.sourceHash = contract.sourceHash;
  entry.translationHash = hash(value);
  await writeFile(file, JSON.stringify(value));
  updated++;
}
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`rehashed ${updated} manifest entries to stable sourceHash values`);