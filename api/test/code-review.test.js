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

test("suggested solutions preserve vertical formatting for supported languages", () => {
  const solutions = [
    "function solution(input) {\n  return input.length;\n}",
    "def solution(values):\n    return len(values)",
    "static int solution(int[] values) {\n    return values.length;\n}",
    "static int Solution(int[] values)\n{\n    return values.Length;\n}",
    "fn solution(values: &[i32]) -> usize {\n    values.len()\n}",
  ];
  for (const suggestedCode of solutions) {
    const raw = {
      score: 8,
      verdict: "Good foundation.",
      strengths: ["Readable."],
      improvements: ["Add edge-case coverage."],
      complexity: "O(n).",
      suggestedCode: `\`\`\`language\n${suggestedCode}\n\`\`\``,
    };
    assert.equal(normalizeCodeReview(raw).suggestedCode, suggestedCode);
  }
});
