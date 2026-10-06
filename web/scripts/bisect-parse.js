"use strict";
const fs = require("fs");
const vm = require("vm");
const file = process.argv[2];
const lines = fs.readFileSync(file, "utf8").split("\n");
let lo = 1, hi = lines.length, first = null;
// Find smallest prefix length where parse of "wrapped" prefix is a template/brace mismatch
// Heuristic: parse the prefix as an expression list won't work; instead, find first line
// where parsing the whole prefix as a Function body throws with an *unclosed* token error.
function stateOf(n) {
  const src = lines.slice(0, n).join("\n");
  try {
    vm.compileFunction(src, [], {});
    return "ok";
  } catch (e) {
    const msg = e.message;
    if (/^\{/.test(msg) || /unterminated/i.test(msg) || /Unexpected end/.test(msg)) return "unclosed";
    if (/^Unexpected token/.test(msg)) return "badtoken:" + msg.split("\n")[0];
    return "other:" + msg.split("\n")[0];
  }
}
// Scan all prefixes; print the line where the state first changes from ok to something, and every transition
let prev = "ok";
for (let n = 1; n <= lines.length; n++) {
  const s = stateOf(n);
  const cls = s.split(":")[0];
  if (cls !== prev.split(":")[0]) {
    console.log("transition at line", n, prev, "->", s, "| line text:", JSON.stringify(lines[n - 1].slice(0, 120)));
    prev = s;
  }
}
console.log("final state at", lines.length, ":", stateOf(lines.length));
