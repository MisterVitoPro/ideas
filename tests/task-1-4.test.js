"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const { read } = require("./contract.test.js");

// Extracts a heading's body: from the heading line (exact match after trim) up to
// (but not including) the next top-level "## " heading, or end of file.
function sectionBody(text, heading) {
  const lines = text.split("\n");
  const startIdx = lines.findIndex((l) => l.trim() === heading.trim());
  assert.ok(startIdx !== -1, "heading not found: " + heading);
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^##(?!#)/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx).join("\n");
}

const TEMPLATE = "skills/interview/references/spec-template.md";
const CRAFT = "skills/interview/references/question-craft.md";

test("template v2: three new headings present", () => {
  const t = read(TEMPLATE);
  assert.ok(t.includes("## Architecture & components"), "Architecture & components heading");
  assert.ok(t.includes("## Verification strategy"), "Verification strategy heading");
  assert.ok(t.includes("### Non-functional requirements"), "Non-functional requirements subheading");
});

test("template v2: Architecture & components sits between Chosen approach and Data & interfaces", () => {
  const t = read(TEMPLATE);
  const chosenIdx = t.indexOf("## Chosen approach");
  const archIdx = t.indexOf("## Architecture & components");
  const dataIdx = t.indexOf("## Data & interfaces");
  assert.ok(chosenIdx !== -1 && archIdx !== -1 && dataIdx !== -1, "all three headings exist");
  assert.ok(chosenIdx < archIdx, "Architecture & components comes after Chosen approach");
  assert.ok(archIdx < dataIdx, "Architecture & components comes before Data & interfaces");
});

test("template v2: Verification strategy sits after Acceptance criteria (EARS)", () => {
  const t = read(TEMPLATE);
  const earsIdx = t.indexOf("## Acceptance criteria (EARS)");
  const verIdx = t.indexOf("## Verification strategy");
  assert.ok(earsIdx !== -1 && verIdx !== -1, "both headings exist");
  assert.ok(earsIdx < verIdx, "Verification strategy comes after Acceptance criteria (EARS)");
});

test("template v2: Non-functional requirements nested inside Requirements", () => {
  const t = read(TEMPLATE);
  const reqIdx = t.indexOf("## Requirements");
  const nfrIdx = t.indexOf("### Non-functional requirements");
  const chosenIdx = t.indexOf("## Chosen approach");
  assert.ok(reqIdx !== -1 && nfrIdx !== -1 && chosenIdx !== -1, "all three headings exist");
  assert.ok(reqIdx < nfrIdx, "Non-functional requirements comes after the Requirements heading");
  assert.ok(nfrIdx < chosenIdx, "Non-functional requirements stays inside Requirements, before Chosen approach");
});

test("template v2: Non-functional requirements numbered in the shared requirement sequence with ledger citations", () => {
  const t = read(TEMPLATE);
  const reqIdx = t.indexOf("## Requirements");
  const chosenIdx = t.indexOf("## Chosen approach");
  const requirementsSection = t.slice(reqIdx, chosenIdx);
  assert.ok(/shared requirement sequence/i.test(requirementsSection),
    "requirements section explains NFRs share the numbering sequence");
  assert.ok(/ledger/i.test(requirementsSection.slice(requirementsSection.indexOf("### Non-functional requirements"))),
    "Non-functional requirements subsection cites the ledger");
});

test("template v2: None acceptable at S scope for Architecture & components and Verification strategy", () => {
  const t = read(TEMPLATE);
  const arch = sectionBody(t, "## Architecture & components");
  const ver = sectionBody(t, "## Verification strategy");
  assert.ok(/None/.test(arch), "Architecture & components allows writing None when empty");
  assert.ok(/S.?scope/i.test(arch), "Architecture & components ties the None fallback to S scope");
  assert.ok(/None/.test(ver), "Verification strategy allows writing None when empty");
  assert.ok(/S.?scope/i.test(ver), "Verification strategy ties the None fallback to S scope");
});

test("template v2: both new sections are mandatory at every scope", () => {
  const t = read(TEMPLATE);
  const arch = sectionBody(t, "## Architecture & components");
  const ver = sectionBody(t, "## Verification strategy");
  assert.ok(/mandatory/i.test(arch), "Architecture & components states it is mandatory at every scope");
  assert.ok(/mandatory/i.test(ver), "Verification strategy states it is mandatory at every scope");
});

test("template v2: Verification strategy tags each acceptance-criteria group unit, integration, or manual", () => {
  const t = read(TEMPLATE);
  const ver = sectionBody(t, "## Verification strategy");
  assert.ok(/\bunit\b/i.test(ver), "unit tag referenced");
  assert.ok(/\bintegration\b/i.test(ver), "integration tag referenced");
  assert.ok(/\bmanual\b/i.test(ver), "manual tag referenced");
});

test("question-craft: Verification standing probe added alongside Lifecycle, Non-functionals, Interfaces", () => {
  const c = read(CRAFT);
  const standing = sectionBody(c, "## Standing probes");
  assert.ok(/-\s*Verification:/i.test(standing), "Verification standing probe bullet present");
  assert.ok(/unit\/integration\/manual split/i.test(standing), "probe references the unit/integration/manual split");
  assert.ok(/harness/i.test(standing), "probe references harness");
  assert.ok(/fixtures/i.test(standing), "probe references fixtures");
});
