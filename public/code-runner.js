"use strict";

window.addEventListener("message", function (event) {
  if (event.source !== parent || !event.data || event.data.type !== "run") return;

  var runId = event.data.runId;

  try {
    var factory = Function(
      '"use strict";\n' +
        String(event.data.code).slice(0, 12000) +
        '\n;return typeof solution === "function" ? solution : null;',
    );
    var solution = factory();

    if (typeof solution !== "function") {
      throw new Error("Define a function named solution.");
    }

    var tests = Array.isArray(event.data.tests) ? event.data.tests.slice(0, 10) : [];
    var results = tests.map(function (test) {
      try {
        var actual = solution(structuredClone(test.input));
        var passed = JSON.stringify(actual) === JSON.stringify(test.expected);
        return { passed: passed, actual: actual, expected: test.expected };
      } catch (error) {
        return {
          passed: false,
          error: error instanceof Error ? error.message.slice(0, 200) : "Execution failed",
          expected: test.expected,
        };
      }
    });

    parent.postMessage(
      { source: "interviewiq-code-runner", runId: runId, results: results },
      "*",
    );
  } catch (error) {
    parent.postMessage(
      {
        source: "interviewiq-code-runner",
        runId: runId,
        error: error instanceof Error ? error.message.slice(0, 200) : "Execution failed",
      },
      "*",
    );
  }
});
