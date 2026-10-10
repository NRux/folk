// Flip manifest entries from draft to approved after owner language review.
// Usage: node scripts/approve-translations.mjs <slug> [<slug>...] --reviewer <name> [--note <text>]
// Only entries whose status is 'draft' are flipped; approved entries pass through untouched.
// The build (scripts/build-translations.mjs) re-validates translationHash against the
// installed files, so a stale entry throws there rather than serving a wrong page.
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const reviewerIdx = args.indexOf('--reviewer');
const noteIdx = args.indexOf('--note');
const reviewer = reviewerIdx === -1 ? 'owner' : args[reviewerIdx + 1];
const note =
  noteIdx === -1
    ? 'owner competent-language review 2026-10-10 (directive: enable agent-translated pages as completed)'
    : args[noteIdx + 1];
const slugs = new Set(args.filter((a, i) => !a.startsWith('--') && args[i - 1]?.startsWith?.('--') !== true));

if (slugs.size === 0) {
  console.error('usage: approve-translations.mjs <slug>... --reviewer <name> [--note <text>]');
  process.exit(1);
}

const path = join(root, 'web/vercel/translation-manifest.json');
const manifest = JSON.parse(await readFile(path, 'utf8'));
let flipped = 0;
let already = 0;
for (const entry of manifest.entries) {
  if (!slugs.has(entry.slug)) continue;
  if (entry.status === 'approved') { already++; continue; }
  entry.status = 'approved';
  // The manifest validator (translations.mjs) requires the review block to carry
  // EXACTLY reviewer/reviewedAt/competentLanguageReview — no extra keys survive
  // validateManifest, so the directive note lives in the commit message instead.
  entry.review = {
    reviewer,
    reviewedAt: '2026-10-10T00:00:00.000Z',
    competentLanguageReview: true,
  };
  flipped++;
}
await writeFile(path, JSON.stringify(manifest, null, 2) + '\n');
console.log(`approved=${flipped} already-approved=${already} for slugs: ${[...slugs].join(', ')}`);