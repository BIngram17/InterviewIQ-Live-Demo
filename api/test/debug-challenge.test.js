import test from "node:test";
import assert from "node:assert/strict";
import { validateChallenge } from "../src/lib/coding-practice.js";
import { buildRubricFallbackChanges } from "../src/lib/resume-review.js";

const fixture = {
  title: "Repair the character counter", goal: "Find a boundary bug", prompt: "Return the number of characters.",
  examples: ['"abc" returns 3'], constraints: ["ASCII strings only", "Empty input allowed"], concepts: ["Boundaries"],
  inputType: "string", outputType: "integer",
  tests: [{ input: "", expected: 0 }, { input: "a", expected: 1 }, { input: "abc", expected: 3 }],
};

test("debug challenges require bounded starter code and preserve its indentation", () => {
  assert.equal(validateChallenge(fixture, "debug"), null);
  const starterCode = "def solution(input):\n    return len(input) - 1";
  assert.equal(validateChallenge({ ...fixture, starterCode }, "debug").starterCode, starterCode);
  assert.equal(validateChallenge({ ...fixture, starterCode: "x".repeat(6001) }, "debug"), null);
  assert.equal(validateChallenge({ ...fixture, starterCode: "def other(input): return 0" }, "debug"), null);
});

test("rubric fallback does not manufacture work or point gains for met criteria", () => {
  assert.deepEqual(buildRubricFallbackChanges([{ id: "met", requirement: "Python", status: "met" }]), []);
  const changes = buildRubricFallbackChanges([{ id: "gap", requirement: "Python", status: "missing" }]);
  assert.equal(changes[0].scoreImpact, 0);
  assert.equal(changes[0].kind, "needs-info");
});
