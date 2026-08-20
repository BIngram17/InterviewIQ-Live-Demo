import assert from "node:assert/strict";
import test from "node:test";
import { countWords, coverLetterInRange, coverLetterNotes, currentDateIso, endsWithOmission, mislabelsCompletedPastDate, normalizeEvaluationCriteria, requestsSkillDeletion, resumeContainsEvidence, resumeScoringRubric, safeChangeKind, safeChangeOperation, scoreEvaluationCriteria } from "../src/lib/resume-review.js";

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

test("accepts only cover letters between 325 and 400 words", () => {
  assert.equal(coverLetterInRange("word ".repeat(324)), false);
  assert.equal(coverLetterInRange("word ".repeat(325)), true);
  assert.equal(coverLetterInRange("word ".repeat(400)), true);
  assert.equal(coverLetterInRange("word ".repeat(401)), false);
});

test("keeps actionable cover-letter notes and removes redundant count summaries", () => {
  assert.deepEqual(coverLetterNotes([
    "Word count: 351 words (target: 350-375).",
    "Paragraph 1: 58 words.",
    "Verify the hiring manager's name before sending.",
  ]), ["Verify the hiring manager's name before sending."]);
});

test("calculates the resume score from the fixed five-category rubric", () => {
  const criteria = resumeScoringRubric.map((item, index) => ({
    id: `criterion-${index}`,
    category: item.category,
    requirement: item.category,
    importance: "quality",
    status: "met",
    projectedStatus: "met",
    evidence: "Verified evidence",
    explanation: "",
  }));
  const result = scoreEvaluationCriteria(criteria);
  assert.equal(result.score, 100);
  assert.deepEqual(result.breakdown.map((item) => item.maxScore), [30, 25, 20, 15, 10]);
});

test("locks criteria and preserves earned credit while its exact evidence remains", () => {
  const previous = [{
    id: "required-react",
    category: "Required qualifications",
    requirement: "Build accessible React applications",
    importance: "required",
    status: "met",
    projectedStatus: "met",
    evidence: "Built accessible React applications",
    explanation: "Direct evidence",
  }];
  const reassessed = [{ ...previous[0], requirement: "Changed requirement", status: "missing", evidence: "" }];
  const normalized = normalizeEvaluationCriteria(reassessed, previous, "Built accessible React applications for customers.");
  const criterion = normalized.find((item) => item.id === "required-react");
  assert.equal(criterion.requirement, "Build accessible React applications");
  assert.equal(criterion.status, "met");
  assert.equal(criterion.evidence, "Built accessible React applications");
});
