const REQUIRED_CHECKS = [
  "citations_resolve",
  "links_valid",
  "mandatory_disclosure",
  "numeric_claims_supported",
  "required_fields",
  "sources_present",
  "word_count",
];

const text = (value) => value == null ? null : String(value);
const number = (value) => value == null ? null : Number(value);
const compare = (a, b) => {
  const left = JSON.stringify(a), right = JSON.stringify(b);
  return left < right ? -1 : left > right ? 1 : 0;
};

export function parseSourceIds(value) {
  try {
    const ids = JSON.parse(String(value));
    return Array.isArray(ids) && ids.every((id) => typeof id === "string" && id) ? ids : null;
  } catch {
    return null;
  }
}

export function validateEvidence({ sources, claims, checks }) {
  const sourceIds = new Set(sources.map((source) => String(source.id)));
  const hosts = new Set(sources.map((source) => {
    try { return new URL(String(source.url)).hostname.replace(/^www\./, "").toLowerCase(); }
    catch { return ""; }
  }).filter(Boolean));
  const strong = sources.filter((source) => ["primary", "local", "scholarly", "institutional", "practitioner"]
    .includes(String(source.publisher || source.source_type || "").toLowerCase())).length;
  if (sources.length < 5 || hosts.size < 3 || strong < 2 || !claims.length) return false;
  if (claims.some((claim) => {
    const ids = parseSourceIds(claim.source_ids);
    return !ids?.length || ids.some((id) => !sourceIds.has(id));
  })) return false;
  const results = new Map(checks.map((check) => [String(check.check_name), String(check.result)]));
  return REQUIRED_CHECKS.every((name) => results.get(name) === "pass") &&
    !checks.some((check) => check.result === "fail");
}

export function canonicalEvidence({ sources, claims, checks, media = null }) {
  return {
    sources: sources.map((source) => ({
      id: text(source.id), ord: number(source.ord), title: text(source.title),
      org_author: text(source.org_author), url: text(source.url), pub_date: text(source.pub_date),
      retrieved_at: text(source.retrieved_at), lang: text(source.lang), publisher: text(source.publisher),
      source_type: text(source.source_type),
    })).sort(compare),
    claims: claims.map((claim) => ({
      id: text(claim.id), claim: text(claim.claim),
      source_ids: (parseSourceIds(claim.source_ids) || []).slice().sort(),
      kind: text(claim.kind), verified: number(claim.verified),
    })).sort(compare),
    checks: checks.map((check) => ({
      check_name: text(check.check_name), check_type: text(check.check_type),
      result: text(check.result), details: text(check.details),
    })).sort(compare),
    media: media ? {
      file_path: text(media.file_path), original_url: text(media.original_url), creator: text(media.creator),
      license: text(media.license), license_url: text(media.license_url), attribution: text(media.attribution),
      sha256: text(media.sha256), caption: text(media.caption), alt_text: text(media.alt_text),
    } : null,
  };
}

export async function evidenceDigest(evidence) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalEvidence(evidence)));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Recheck mutable D1 evidence in the same atomic batch that claims the daily slot.
// The immutable source attestation is checked immediately before this statement.
export const PUBLICATION_GUARD_SQL = `
SELECT 1 FROM articles a JOIN article_versions v ON v.id=? AND v.article_id=a.id
WHERE a.id=? AND a.status='draft' AND a.pipeline_state='ready' AND a.content_hash=?
  AND v.id=(SELECT id FROM article_versions WHERE article_id=a.id ORDER BY version DESC LIMIT 1)
  AND (SELECT COUNT(*) FROM sources s WHERE s.article_version_id=v.id)>=5
  AND (SELECT COUNT(DISTINCT s.url) FROM sources s WHERE s.article_version_id=v.id)>=3
  AND (SELECT COUNT(*) FROM sources s WHERE s.article_version_id=v.id
    AND lower(COALESCE(s.publisher,s.source_type,'')) IN ('primary','local','scholarly','institutional','practitioner'))>=2
  AND EXISTS(SELECT 1 FROM claim_citations c WHERE c.article_version_id=v.id)
  AND NOT EXISTS(
    SELECT 1 FROM claim_citations c WHERE c.article_version_id=v.id AND (
      json_valid(c.source_ids)=0 OR json_array_length(c.source_ids)=0 OR EXISTS(
        SELECT 1 FROM json_each(c.source_ids) link WHERE NOT EXISTS(
          SELECT 1 FROM sources s WHERE s.article_version_id=v.id AND s.id=CAST(link.value AS TEXT)
        )
      )
    )
  )
  AND (SELECT COUNT(DISTINCT e.check_name) FROM editorial_checks e
    WHERE e.article_version_id=v.id AND e.result='pass' AND e.check_name IN
      ('citations_resolve','links_valid','mandatory_disclosure','numeric_claims_supported','required_fields','sources_present','word_count'))=7
  AND NOT EXISTS(SELECT 1 FROM editorial_checks e WHERE e.article_version_id=v.id AND e.result='fail')
  AND instr(lower(COALESCE(json_extract(v.content_json,'$.note.text'),'')),'ai editorial persona')>0
  AND instr(lower(COALESCE(json_extract(v.content_json,'$.note.text'),'')),'linked sources')>0
  AND instr(lower(COALESCE(json_extract(v.content_json,'$.note.text'),'')),'no firsthand experience')>0
  AND (json_extract(v.content_json,'$.figure.src') IS NULL OR EXISTS(
    SELECT 1 FROM media_assets m WHERE m.file_path=json_extract(v.content_json,'$.figure.src')
      AND length(trim(COALESCE(m.license,'')))>0 AND length(trim(COALESCE(m.license_url,'')))>0
      AND length(trim(COALESCE(m.attribution,'')))>0
  ))`;

export { REQUIRED_CHECKS };
