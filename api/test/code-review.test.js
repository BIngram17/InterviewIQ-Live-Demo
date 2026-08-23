import assert from "node:assert/strict";
import test from "node:test";
import { hasCompleteCodeReview, normalizeCodeReview } from "../src/lib/code-review.js";

test("guided review accepts empty arrays and preserves passing execution evidence", () => {
  const raw = {
    score: 10,
    verdict: "The solution is correct and readable.",
    strengths: [],
    improvements: [],
    complexity: "O(n) time and O(1) auxiliary space.",
  };

  assert.equal(hasCompleteCodeReview(raw, true), true);
  const result = normalizeCodeReview(raw, { guidedReview: true, testSummary: "5/5 executed tests passed" });
  assert.deepEqual(result.strengths, ["Execution evidence: 5/5 executed tests passed."]);
  assert.match(result.improvements[0], /No critical code change/);
});

test("code review accepts common response aliases and numeric score labels", () => {
  const raw = {
    rating: "8.5/10",
    assessment: "The approach is sound.",
    whatWorks: ["Uses a single pass."],
    nextActions: ["Clarify one variable name."],
    complexityAnalysis: "O(n) time and O(n) space.",
  };

  assert.equal(hasCompleteCodeReview(raw, true), true);
  const result = normalizeCodeReview(raw, { guidedReview: true });
  assert.equal(result.score, 8.5);
  assert.equal(result.verdict, "The approach is sound.");
  assert.deepEqual(result.strengths, ["Uses a single pass."]);
});

test("non-guided review still requires suggested code", () => {
  const raw = {
    score: 8,
    verdict: "Good foundation.",
    strengths: ["Readable."],
    improvements: ["Handle empty input."],
    complexity: "O(n).",
  };
  assert.equal(hasCompleteCodeReview(raw, false), false);
});
