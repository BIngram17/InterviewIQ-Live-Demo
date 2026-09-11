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
test("debug projects require safe distinct files and symptom reports", () => {
  const files = [
    { name: "policy.js", content: "function rate() { return 0; }" },
    { name: "billing.js", content: "function total(n) { return n - rate(); }" },
    { name: "solution.js", content: "function solution(input) { return total(input); }" },
  ];
  const project = { ...fixture, files, bugReports: ["Returning customers receive no discount."] };
  const valid = validateChallenge(project, "debug", true);
  assert.equal(valid.files.length, 3);
  assert.equal(valid.examples[0], '"" → 0');
  assert.equal(valid.starterCode, files.map((f) => f.content).join("\n\n"));
  assert.equal(validateChallenge({ ...project, bugReports: [] }, "debug", true), null);
  assert.equal(validateChallenge({ ...project, files: files.slice(0, 2) }, "debug", true), null);
  assert.equal(validateChallenge({ ...project, files: files.map((f) => ({ ...f, name: "same.js" })) }, "debug", true), null);
  assert.equal(validateChallenge({ ...project, files: [{ ...files[0], name: "../policy.js" }, ...files.slice(1)] }, "debug", true), null);
});
