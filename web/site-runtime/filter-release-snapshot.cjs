"use strict";
// Restrict the private migration to the four published legacy articles and the
// seven reviewed, ready reserve stories. Held/failed drafts never leave the local DB.
const fs = require("node:fs");
const { createHash } = require("node:crypto");
const path = require("node:path");
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("Usage: filter-release-snapshot.cjs <private-source.json> <private-output.json>");
if (fs.existsSync(output)) throw new Error("Refusing to overwrite a private release snapshot");
const original = JSON.parse(fs.readFileSync(input, "utf8"));
if (original.format !== "folkly-d1-snapshot-v1" || original.release_state !== "unpublished") throw new Error("Invalid source");
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "reserve-seed.json"), "utf8"));
if (seed.format !== "folkly-reserve-v1" || seed.release_state !== "unpublished") throw new Error("Invalid reviewed reserve");
const reviewed = new Map(seed.articles.map(({ article, version, review }) => {
  if (review?.verdict !== "pass") throw new Error(`Unreviewed reserve article: ${article.slug}`);
  return [article.slug, { versionId: version.id, hash: article.content_hash, content: JSON.stringify(version.content) }];
}));
if (reviewed.size !== 7) throw new Error("Unexpected reviewed reserve size");
const records = structuredClone(original.records);
records.articles = records.articles.filter((a) => a.status === "published" ||
  (a.status === "draft" && a.pipeline_state === "ready" && reviewed.has(a.slug)));
const published = records.articles.filter((a) => a.status === "published");
const reserve = records.articles.filter((a) => a.status === "draft");
if (published.length !== 4 || reserve.length !== 7) throw new Error("Unexpected published/reserve count");
for (const article of reserve) {
  const match = reviewed.get(article.slug);
  const versions = records.article_versions.filter((version) => version.article_id === article.id);
  if (match.hash !== article.content_hash || !versions.some((version) => version.id === match.versionId && version.content_json === match.content)) {
    throw new Error(`Review/version mismatch: ${article.slug}`);
  }
}
const articleIds = new Set(records.articles.map((a) => a.id));
records.article_versions = records.article_versions.filter((v) => articleIds.has(v.article_id));
const versionIds = new Set(records.article_versions.map((v) => v.id));
for (const table of ["sources", "claim_citations", "editorial_checks"]) {
  records[table] = records[table].filter((row) => versionIds.has(row.article_version_id));
}
// Pitch backlog and assignment planning are local work and not required for the
// release reader or the reviewed reserve. Import them later through scoped ops.
records.pitches = [];
records.assignments = [];
const referencedMedia = new Set(records.articles.map((a) => a.home_figure_src).filter(Boolean));
records.media_assets = records.media_assets.filter((m) => referencedMedia.has(m.file_path));
const payload = { format: original.format, release_state: original.release_state, records };
const sha256 = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
fs.writeFileSync(output, JSON.stringify({ ...payload, sha256 }) + "\n", { flag: "wx", mode: 0o600 });
console.log(JSON.stringify({ published: published.map((a) => a.slug), reserve: reserve.map((a) => a.slug),
  versions: records.article_versions.length, sources: records.sources.length, claims: records.claim_citations.length,
  checks: records.editorial_checks.length, pitches: 0, held_or_failed: 0 }));
