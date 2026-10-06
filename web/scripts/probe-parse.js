"use strict";
const fs = require("fs");
const vm = require("vm");
const file = process.argv[2];
const src = fs.readFileSync(file, "utf8");
try {
  vm.compileFunction(src, [], { produceAtomics: false });
  console.log("PARSE OK");
} catch (e) {
  console.log("PARSE FAIL:", e.message);
  const m = String(e.stack || "").split("\n").slice(0, 6).join("\n");
  console.log(m);
}
