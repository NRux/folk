"use strict";
const fs = require("fs");
const file = process.argv[2];
const a = parseInt(process.argv[3], 10);
const b = parseInt(process.argv[4], 10);
const lines = fs.readFileSync(file, "utf8").split("\n");
for (let i = a - 1; i < b && i < lines.length; i++) {
  console.log(i + 1 + " " + JSON.stringify(lines[i]));
}
