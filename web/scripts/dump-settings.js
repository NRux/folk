"use strict";
const { openDb, settingsGetAll } = require("../lib/db");
const db = openDb(process.argv[2] || "folkly.db");
const s = settingsGetAll(db);
for (const k of Object.keys(s).sort()) console.log(k + " = " + s[k]);
console.log("---");
console.log("timeout_ms setting:", s["provider.llm.timeout_ms"]);
console.log("max_tokens setting:", s["provider.llm.max_tokens"]);
