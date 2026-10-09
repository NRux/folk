import { env } from "cloudflare:workers";
import reviewed from "./reviewed-reserve.json";
import { evidenceDigest, PUBLICATION_GUARD_SQL, validateEvidence } from "./publication-gates.mjs";

const TZ = "America/Los_Angeles";
type Article = { id: string; slug: string; title: string; content_hash: string; status: string; pipeline_state: string };
type Version = { id: string; version: number; content_json: string };

function localClock(at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))))
  .map((b) => b.toString(16).padStart(2, "0")).join("");

async function eligible(db: D1Database, article: Article): Promise<Version | null> {
  const attestation = reviewed.find((r) => r.slug === article.slug && r.content_hash === article.content_hash && r.verdict === "pass");
  if (!attestation || article.status !== "draft" || article.pipeline_state !== "ready") return null;
  const version = await db.prepare("SELECT id,version,content_json FROM article_versions WHERE article_id=? ORDER BY version DESC LIMIT 1")
    .bind(article.id).first<Version>();
  if (!version || version.id !== attestation.version_id || await digest(version.content_json) !== article.content_hash) return null;
  const [sourceResult, claimsResult, checksResult] = await Promise.all([
    db.prepare(`SELECT id,ord,title,org_author,url,pub_date,retrieved_at,lang,publisher,source_type
      FROM sources WHERE article_version_id=?`).bind(version.id).all(),
    db.prepare("SELECT id,claim,source_ids,kind,verified FROM claim_citations WHERE article_version_id=?").bind(version.id).all(),
    db.prepare("SELECT check_name,check_type,result,details FROM editorial_checks WHERE article_version_id=?").bind(version.id).all(),
  ]);
  if (!validateEvidence({ sources: sourceResult.results, claims: claimsResult.results, checks: checksResult.results })) return null;
  let content;
  try { content = JSON.parse(version.content_json); } catch { return null; }
  if (!/AI editorial persona/i.test(content.note?.text || "") || !/linked sources/i.test(content.note?.text || "") ||
      !/no firsthand experience/i.test(content.note?.text || "")) return null;
  let media = null;
  if (content.figure?.src) {
    media = await db.prepare(`SELECT file_path,original_url,creator,license,license_url,attribution,sha256,caption,alt_text
      FROM media_assets WHERE file_path=?`).bind(content.figure.src).first();
    if (!media?.license || !media.license_url || !media.attribution) return null;
  }
  if (await evidenceDigest({ sources: sourceResult.results, claims: claimsResult.results,
    checks: checksResult.results, media }) !== attestation.evidence_hash) return null;
  return version;
}

export async function publicationStatus() {
  if (!env.DB) throw new Error("database unavailable");
  const { date, time } = localClock(new Date());
  const settings = await env.DB.prepare("SELECT key,value FROM settings").all();
  const config = Object.fromEntries(settings.results.map((row) => [row.key, row.value]));
  const slot = await env.DB.prepare("SELECT slot_date,status,article_version_id,published_at,readback_hash FROM publication_slots WHERE slot_date=?")
    .bind(date).first();
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM articles WHERE status='draft' AND pipeline_state='ready'").first<{ n: number }>();
  return { date, time, timezone: TZ, publish_time: config["schedule.publish_time"] || "07:00",
    schedule_enabled: config["schedule.enabled"] === "true", production_enabled: config["production.autonomous_enabled"] === "true",
    publication_enabled: config["publication.autonomous_enabled"] === "true", ready_reserve: count?.n || 0,
    slot: slot ?? null };
}

export async function publishToday(actor: string, { dryRun = false, at = new Date() } = {}) {
  if (!env.DB) throw new Error("database unavailable");
  const db = env.DB;
  const clock = localClock(at);
  const settings = await db.prepare("SELECT key,value FROM settings").all();
  const config = Object.fromEntries(settings.results.map((row) => [row.key, row.value]));
  const current = await db.prepare("SELECT slot_date,status,article_version_id,published_at FROM publication_slots WHERE slot_date=?")
    .bind(clock.date).first();
  if (current?.status === "published") return { state: "already-published", slot: current };
  if (!dryRun && (config["schedule.enabled"] !== "true" || config["publication.autonomous_enabled"] !== "true"))
    return { state: "disabled", slot_date: clock.date };
  if (!dryRun && clock.time < (config["schedule.publish_time"] || "07:00"))
    return { state: "not-due", slot_date: clock.date };
  const candidates = await db.prepare("SELECT id,slug,title,content_hash,status,pipeline_state FROM articles WHERE status='draft' AND pipeline_state='ready' ORDER BY updated_at,id").all<Article>();
  let choice: Article | null = null, version: Version | null = null;
  for (const candidate of candidates.results) {
    const checked = await eligible(db, candidate);
    if (checked) { choice = candidate; version = checked; break; }
  }
  if (dryRun) return { state: choice ? "eligible" : "no-eligible-reserve", slot_date: clock.date,
    candidate: choice ? { slug: choice.slug, version_id: version!.id } : null };
  const stamp = at.toISOString();
  if (!choice || !version) {
    await db.batch([
      db.prepare("INSERT INTO publication_slots(id,slot_date,status,note) VALUES(?,?,'missed','No eligible reviewed reserve article') ON CONFLICT(slot_date) DO NOTHING")
        .bind(`slot-${clock.date}`, clock.date),
      db.prepare("INSERT INTO admin_alerts(id,kind,message,slot_date,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING")
        .bind(`empty-reserve-${clock.date}`, "empty-reserve", "No eligible reviewed article was available for today's slot", clock.date, stamp),
    ]);
    return { state: "no-eligible-reserve", slot_date: clock.date };
  }
  const slotId = `slot-${clock.date}`;
  await db.batch([
    db.prepare(`INSERT INTO publication_slots(id,slot_date,article_version_id,status,published_at,published_by,note)
      SELECT ?,?,?,'published',?,?,? WHERE EXISTS (${PUBLICATION_GUARD_SQL})
      ON CONFLICT(slot_date) DO UPDATE SET article_version_id=excluded.article_version_id,
        status='published',published_at=excluded.published_at,published_by=excluded.published_by,note=excluded.note
        WHERE publication_slots.status IN ('open','missed','retryable-failure')`).bind(slotId, clock.date, version.id, stamp, actor,
        `Reviewed version ${version.id}`, version.id, choice.id, choice.content_hash),
    db.prepare(`UPDATE articles SET status='published',pipeline_state='published',updated_at=?
      WHERE id=? AND status='draft' AND EXISTS(SELECT 1 FROM publication_slots
      WHERE slot_date=? AND article_version_id=? AND published_at=?)`).bind(stamp, choice.id, clock.date, version.id, stamp),
    db.prepare(`UPDATE articles SET is_cover=0 WHERE is_cover=1 AND EXISTS(SELECT 1 FROM publication_slots
      WHERE slot_date=? AND article_version_id=? AND published_at=?)`).bind(clock.date, version.id, stamp),
    db.prepare(`UPDATE articles SET is_cover=1,home_position=0 WHERE id=? AND status='published'
      AND EXISTS(SELECT 1 FROM publication_slots WHERE slot_date=? AND article_version_id=? AND published_at=?)`)
      .bind(choice.id, clock.date, version.id, stamp),
    db.prepare(`INSERT INTO scheduler_runs(id,slot_date,state,started_at,finished_at,article_version_id)
      SELECT ?,?,'published',?,?,? WHERE EXISTS(SELECT 1 FROM publication_slots
      WHERE slot_date=? AND article_version_id=? AND published_at=?) ON CONFLICT(id) DO NOTHING`)
      .bind(`scheduler-${clock.date}`, clock.date, stamp, stamp, version.id, clock.date, version.id, stamp),
  ]);
  const row = await db.prepare(`SELECT ps.slot_date,ps.status,ps.article_version_id,ps.published_at,
    a.slug,v.content_json FROM publication_slots ps JOIN article_versions v ON v.id=ps.article_version_id
    JOIN articles a ON a.id=v.article_id WHERE ps.slot_date=?`).bind(clock.date).first<{
      slot_date: string; status: string; article_version_id: string; published_at: string;
      slug: string; content_json: string }>();
  if (!row || row.status !== "published") return { state: "retryable-failure", slot_date: clock.date };
  const readbackHash = await digest(row.content_json);
  await db.prepare("UPDATE publication_slots SET readback_at=?,readback_hash=? WHERE slot_date=? AND status='published'")
    .bind(new Date().toISOString(), readbackHash, clock.date).run();
  return { state: row.article_version_id === version.id ? "published" : "already-published",
    slot_date: clock.date, article_version_id: row.article_version_id, slug: row.slug,
    published_at: row.published_at, readback_hash: readbackHash };
}
