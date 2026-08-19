import assert from "node:assert/strict";
import test from "node:test";
import { countWords, currentDateIso, endsWithOmission, mislabelsCompletedPastDate, requestsSkillDeletion, resumeContainsEvidence, safeChangeKind, safeChangeOperation } from "../src/lib/resume-review.js";

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

test("change operations are restricted to add, replace, or move", () => {
  assert.equal(safeChangeOperation("replace"), "replace");
  assert.equal(safeChangeOperation("delete"), "add");
});

test("safe rewrites require matching evidence from the resume", () => {
  const resume = "Skills: C#, ASP.NET Core, SQL Server, GitHub Actions";
  assert.equal(resumeContainsEvidence(resume, "ASP.NET Core, SQL Server"), true);
  assert.equal(resumeContainsEvidence(resume, "Rust and Kubernetes"), false);
  assert.equal(resumeContainsEvidence(resume, "SQL"), false);
});

test("detects recommendations abbreviated with an ellipsis", () => {
  assert.equal(endsWithOmission("Replace the complete project bullet..."), true);
  assert.equal(endsWithOmission("Move the skills to the final line…"), true);
  assert.equal(endsWithOmission("Replace the complete project bullet."), false);
});

test("detects recommendations that would delete an existing skill", () => {
  assert.equal(requestsSkillDeletion({ section: "Skills", suggestion: "Remove less relevant skills." }), true);
  assert.equal(requestsSkillDeletion({ section: "Skills", suggestion: "Move less relevant skills to Additional Skills." }), false);
});

test("counts cover-letter words across paragraphs and extra whitespace", () => {
  assert.equal(countWords("First paragraph.\n\nSecond   paragraph."), 4);
  assert.equal(countWords("   "), 0);
});
