import assert from "node:assert/strict";
import test from "node:test";
import { countWords, currentDateIso, mislabelsCompletedPastDate, safeChangeKind } from "../src/lib/resume-review.js";

const august2026 = new Date("2026-08-14T12:00:00Z");

test("currentDateIso supplies an unambiguous UTC date", () => {
  assert.equal(currentDateIso(august2026), "2026-08-14");
});

test("rejects a change that calls a conferred past degree date future", () => {
  const resume = "University of the People — B.S. in Computer Science, Conferred April 2026";
  const change = { currentIssue: "Conferred April 2026 is a future date." };
  assert.equal(mislabelsCompletedPastDate(change, resume, august2026), true);
});

test("does not reject a genuinely future expected graduation date", () => {
  const resume = "B.S. in Computer Science — Expected December 2026";
  const change = { currentIssue: "December 2026 is an upcoming graduation date." };
  assert.equal(mislabelsCompletedPastDate(change, resume, august2026), false);
});

test("unknown change classifications default to needs-info", () => {
  assert.equal(safeChangeKind("rewrite"), "rewrite");
  assert.equal(safeChangeKind("unexpected-value"), "needs-info");
  assert.equal(safeChangeKind(undefined), "needs-info");
});

test("counts cover-letter words across paragraphs and extra whitespace", () => {
  assert.equal(countWords("First paragraph.\n\nSecond   paragraph."), 4);
  assert.equal(countWords("   "), 0);
});
