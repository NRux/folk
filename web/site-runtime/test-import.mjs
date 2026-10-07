import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { importSnapshot } from "./import-snapshot.mjs";

const require = createRequire(import.meta.url);
const { exportSnapshot } = require("./export-snapshot.cjs");
const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(root, "..", "folkly.db");
const temporary = mkdtempSync(path.join(tmpdir(), "folkly-import-"));
const destination = new DatabaseSync(":memory:");

function d1(db) {
  return {
    prepare(sql) {
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        first() { return db.prepare(sql).get(...values) ?? null; },
        run() { return db.prepare(sql).run(...values); },
      };
    },
    batch(statements) {
      db.exec("BEGIN");
      try { for (const statement of statements) statement.run(); db.exec("COMMIT"); }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    },
  };
}

try {
  destination.exec(readFileSync(path.join(root, "schema.sql"), "utf8"));
  destination.exec("PRAGMA foreign_keys=ON");
  const output = path.join(temporary, "private-snapshot.json");
  const releasePath = process.env.FOLKLY_RELEASE_SNAPSHOT;
  const exported = releasePath ? null : exportSnapshot(source, output);
  const snapshot = JSON.parse(readFileSync(releasePath || output, "utf8"));
  const expected = exported?.counts ?? Object.fromEntries(Object.entries(snapshot.records).map(([name, rows]) => [name, rows.length]));
  assert.equal(snapshot.release_state, "unpublished");
  assert.equal(expected.articles, snapshot.records.articles.length);
  assert.equal(snapshot.records.articles.filter((a) => a.pipeline_state === "ready" && a.status === "draft").length, 7);
  assert.ok(snapshot.records.articles.some((a) => a.status === "published"));
  const counts = await importSnapshot(d1(destination), snapshot);
  assert.deepEqual(counts, expected);
  assert.deepEqual(await importSnapshot(d1(destination), snapshot), counts);
  await assert.rejects(importSnapshot(d1(destination), { ...snapshot, release_state: "published" }), /Unsupported/);
  const changed = structuredClone(snapshot);
  changed.records.articles[0].title = "Tampered";
  await assert.rejects(importSnapshot(d1(destination), changed), /checksum mismatch/);
  assert.throws(() => exportSnapshot(source, path.join(temporary, "public", "snapshot.json")), /public asset/);
  assert.throws(() => exportSnapshot(source, path.join(root, "snapshot.json")), /outside the repository/);
  console.log(`D1 migration round trip passed: ${counts.articles} articles, ${counts.article_versions} versions, ${counts.sources} sources; repeat and tamper guards passed`);
} finally {
  destination.close();
  rmSync(temporary, { recursive: true, force: true });
}
