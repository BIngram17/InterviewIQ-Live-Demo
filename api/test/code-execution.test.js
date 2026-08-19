import assert from "node:assert/strict";
import test from "node:test";
import { buildExecutionSource, parseExecutionResults, validateExecutionRequest } from "../src/lib/code-execution.js";

const base = { inputType: "integer-array", outputType: "integer", tests: [{ input: [1, 2, 2], expected: 2 }, { input: [], expected: 0 }] };

test("validates bounded execution requests", () => {
  assert.equal(validateExecutionRequest({ ...base, language: "python", code: "def solution(input):\n    return len(set(input))" })?.tests.length, 2);
  assert.equal(validateExecutionRequest({ ...base, language: "python", code: "x" }), null);
  assert.equal(validateExecutionRequest({ ...base, inputType: "object", language: "python", code: "def solution(input): return 0" }), null);
});

test("builds harnesses for all five supported languages", () => {
  const snippets = {
    javascript: "function solution(input) { return new Set(input).size; }",
    python: "def solution(input):\n    return len(set(input))",
    java: "class Solution { static int solution(int[] input) { return input.length; } }",
    csharp: "public static class Solution { public static int solution(int[] input) { return input.Length; } }",
    rust: "fn solution(input: Vec<i32>) -> i32 { input.len() as i32 }",
  };
  for (const [language, code] of Object.entries(snippets)) {
    const source = buildExecutionSource({ ...base, language, code }, "__TEST__");
    assert.match(source, /__TEST__/);
    assert.match(source, /solution/);
  }
});

test("parses only the runner protocol and preserves expected values", () => {
  const results = parseExecutionResults("noise\n__TEST__0:PASS\n__TEST__1:FAIL\n", "__TEST__", base.tests);
  assert.deepEqual(results, [{ passed: true, expected: 2 }, { passed: false, expected: 0 }]);
});
