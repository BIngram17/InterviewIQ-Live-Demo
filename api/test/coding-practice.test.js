import assert from "node:assert/strict";
import test from "node:test";
import { codingChallengeContext, codingChallengeContextLimit, codingLanguages, validateChallenge, valueMatchesExecutionType } from "../src/lib/coding-practice.js";

test("supports all five coding-practice languages", () => {
  assert.deepEqual([...codingLanguages], ["javascript", "python", "java", "csharp", "rust"]);
});

test("validates a complete JSON-compatible coding challenge", () => {
  const result = validateChallenge({
    title: "Count events",
    goal: "Practice frequency maps.",
    prompt: "Return a count for every event type.",
    examples: ['["a", "b", "a"] returns {"a":2,"b":1}'],
    constraints: ["0 to 100 events", "Each event is a string"],
    concepts: ["Hash maps"],
    inputType: "string-array",
    outputType: "integer-array",
    tests: [
      { input: ["a", "b", "a"], expected: [2, 1] },
      { input: [], expected: [] },
      { input: ["x"], expected: [1] },
    ],
  });
  assert.equal(result?.title, "Count events");
  assert.equal(result?.tests.length, 3);
});

test("rejects incomplete challenges and oversized test values", () => {
  assert.equal(validateChallenge({ title: "Missing details" }), null);
  const huge = "x".repeat(1300);
  assert.equal(validateChallenge({
    title: "Too large",
    goal: "Goal",
    prompt: "Prompt",
    examples: ["Example"],
    constraints: ["One", "Two"],
    inputType: "string",
    outputType: "integer",
    tests: [{ input: huge, expected: 1 }, { input: 2, expected: 2 }, { input: 3, expected: 3 }],
  }), null);
});

test("execution value types reject nested, floating-point, and mismatched data", () => {
  assert.equal(valueMatchesExecutionType([1, 2, 3], "integer-array"), true);
  assert.equal(valueMatchesExecutionType([1.5], "integer-array"), false);
  assert.equal(valueMatchesExecutionType([[1]], "integer-array"), false);
  assert.equal(valueMatchesExecutionType("3", "integer"), false);
});

test("preserves a complete maximum-sized generated challenge for coaching", () => {
  const fullChallenge = `${"Prompt detail. ".repeat(390)}Final requirement: focus on the count.`;
  assert.ok(fullChallenge.length < codingChallengeContextLimit);
  assert.equal(codingChallengeContext(fullChallenge), fullChallenge);
  assert.match(codingChallengeContext(fullChallenge), /focus on the count\.$/);
});
