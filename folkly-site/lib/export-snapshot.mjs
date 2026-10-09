// Fixed, read-only transfer surface. Runtime authorization is temporary and
// separate from repository, publisher, and provider credentials.
export const TABLES = ['personas','persona_briefs','pitches','articles','article_versions',
  'assignments','page_blocks','sources','claim_citations','media_assets','editorial_checks'];
const SWITCHES = ['production.autonomous_enabled','publication.autonomous_enabled','schedule.enabled'];
const MAX_ROWS = 5000;
const MAX_BYTES = 10_000_000;
const bytes = value => new TextEncoder().encode(value);
export async function sha256(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes(value))))
    .map(n => n.toString(16).padStart(2, '0')).join('');
}
const headers = { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'none'", 'x-robots-tag': 'noindex, nofollow' };
const deny = status => new Response('Export unavailable', {status, headers});
export async function exportResponse(request, env, now = Date.now()) {
  if (request.method !== 'GET') return deny(405);
  const configured = env.FOLKLY_EXPORT_TOKEN_SHA256;
  const expires = Date.parse(env.FOLKLY_EXPORT_EXPIRES_AT || '');
  if (!/^[a-f0-9]{64}$/.test(configured || '') || !Number.isFinite(expires) ||
      expires <= now || expires - now > 3_600_000) return deny(404);
  const match = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization') || '');
  if (!match || new URL(request.url).search || request.headers.has('range')) return deny(401);
  const candidate = await sha256(match[1]);
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= candidate.charCodeAt(i) ^ configured.charCodeAt(i);
  if (difference) return deny(401);
  try {
    const db = env.DB;
    if (!db) return deny(503);
    // D1 batch executes the fixed reads transactionally. Counts reject partial
    // exports, including any LIMIT overflow. No settings or audit writes occur.
    const stateSql = "SELECT key,value FROM settings WHERE key IN ('production.autonomous_enabled','publication.autonomous_enabled','schedule.enabled') ORDER BY key";
    const statements = [db.prepare(stateSql)];
    for (const table of TABLES) statements.push(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`),
      db.prepare(`SELECT * FROM ${table} ORDER BY ${table === 'page_blocks' ? 'slug' : 'id'} LIMIT ${MAX_ROWS + 1}`));
    statements.push(db.prepare(stateSql));
    const result = await db.batch(statements);
    if (result.length !== statements.length || result.some(r => r.success !== true || !Array.isArray(r.results))) return deny(503);
    for (const state of [result[0].results, result.at(-1).results]) {
      if (state.length !== 3 || SWITCHES.some(key => !state.some(r => r.key === key && r.value === 'false'))) return deny(409);
    }
    const records = {}, counts = {};
    for (let i = 0; i < TABLES.length; i++) {
      const table = TABLES[i], count = result[1 + i * 2].results;
      const rows = result[2 + i * 2].results;
      if (count.length !== 1 || !Number.isSafeInteger(count[0].n) || count[0].n !== rows.length || rows.length > MAX_ROWS) return deny(413);
      records[table] = rows;
      counts[table] = rows.length;
    }
    const payload = {format:'folkly-d1-snapshot-v1',release_state:'unpublished',records};
    const serialized = JSON.stringify(payload);
    if (bytes(serialized).byteLength > MAX_BYTES - 2000) return deny(413);
    const digest = await sha256(serialized);
    const envelope = {snapshot:{...payload,sha256:digest},receipt:{sha256:digest,counts}};
    return Response.json(envelope, {headers});
  } catch { return deny(503); }
}
