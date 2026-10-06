"use strict";
const { ddgSearch } = require("../lib/search");
(async () => {
  const t0 = Date.now();
  try {
    const items = await ddgSearch("Tokushima aizome indigo dyeing", { max: 10 });
    console.log(`search ok in ${((Date.now() - t0) / 1000).toFixed(1)}s: ${items.length} results`);
    for (const it of items.slice(0, 3)) console.log("  -", (it.title || "").slice(0, 60), "|", it.url);
  } catch (e) {
    console.log(`search FAIL in ${((Date.now() - t0) / 1000).toFixed(1)}s:`, e.message);
  }
})();
