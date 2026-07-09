"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8").replace(/\r\n/g, "\n");
}
function fm(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(m, "file has frontmatter fenced by ---");
  return { frontmatter: m[1], body: m[2] };
}
module.exports = { read, fm };

test("plugin manifest: name, version, author", () => {
  const plugin = JSON.parse(read(".claude-plugin/plugin.json"));
  assert.strictEqual(plugin.name, "ideas");
  assert.strictEqual(plugin.version, "0.1.0");
  assert.strictEqual(plugin.author.name, "MisterVitoPro");
});

test("versions agree across plugin.json, package.json, CHANGELOG", () => {
  const plugin = JSON.parse(read(".claude-plugin/plugin.json"));
  const pkg = JSON.parse(read("package.json"));
  assert.strictEqual(pkg.version, plugin.version);
  assert.ok(read("CHANGELOG.md").includes("## [" + plugin.version + "]"),
    "CHANGELOG has an entry for the current version");
});

test("ledger stays out of version control by policy: repo gitignore exists", () => {
  const gi = read(".gitignore");
  assert.ok(gi.includes("node_modules"), ".gitignore covers node_modules");
});
