"use strict";
const assert = require("node:assert/strict");
const { ipIsPrivate } = require("../lib/search");
const { sourceRulesCheck } = require("../lib/pipeline");

for (const ip of ["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "100.64.0.1", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "2001:db8::1"]) {
  assert.equal(ipIsPrivate(ip), true, `expected private/reserved: ${ip}`);
}
for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) {
  assert.equal(ipIsPrivate(ip), false, `expected public: ${ip}`);
}

const dossier = {
  sources: [
    { url: "https://museum.example.org/item", publisher_class: "institutional", text_excerpt: "Amina Kone, local textile conservator, describes the weaving." },
    { url: "https://journal.example.net/paper", publisher_class: "scholarly", text_excerpt: "Research paper." },
    { url: "https://archive.example.com/record", publisher_class: "primary", text_excerpt: "Archive record." },
    { url: "https://news.example.co.uk/story", publisher_class: "secondary", text_excerpt: "Reporting." },
    { url: "https://culture.example.edu/guide", publisher_class: "local", text_excerpt: "Guide." },
  ],
  claims: [{ claim: "A supported detail", source_indices: [1, 2] }],
  namedLocalVoices: [{ name: "Amina Kone", role: "textile conservator", source_indices: [1] }],
};
assert.equal(sourceRulesCheck(dossier).ok, true);
assert.equal(sourceRulesCheck({ ...dossier, claims: [{ claim: "Bad reference", source_indices: [0, 99] }] }).ok, false);
assert.equal(sourceRulesCheck({ ...dossier, namedLocalVoices: [{ name: "Invented person", role: "expert", source_indices: [1] }] }).ok, false);
console.log("Stage 04 focused security checks passed.");
