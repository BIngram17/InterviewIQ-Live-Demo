// Opt-in production smoke test; uses synthetic candidate data and consumes AI quota.
const base = process.argv[2];
if (!base || !/^https:\/\//.test(base)) throw Error("Supply the HTTPS base URL to test.");
async function post(path, body) {
  const start = performance.now();
  const response = await fetch(new URL(path, base), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(65000),
  });
  const payload = await response.json();
  if (!response.ok) throw Error(path + ": " + response.status + " " + payload.error);
  return { payload, seconds: Number(((performance.now() - start) / 1000).toFixed(2)) };
}
let failures = 0;
try {
  const { payload, seconds } = await post("/api/interview", {
    jobTitle: "Customer Support Specialist", company: "Example Services", level: "entry", interviewType: "behavioral",
    includeCommon: true,
    resume: "Jordan Lee. Customer support associate. Built a training guide for new colleagues, resolved billing questions, and volunteered as a community event coordinator.",
    jobDescription: "Assist customers with billing and service questions, document recurring issues, communicate clearly, and collaborate with colleagues to improve the support experience.",
  });
  if (payload.questions?.length !== 6) throw Error("Incomplete interview.");
  console.log(JSON.stringify({ kind: "interview", seconds, questions: payload.questions.map((q) => q.question) }));
} catch (error) { failures++; console.log(JSON.stringify({ kind: "interview", error: error.message })); }
for (const language of ["javascript", "python", "java", "csharp", "rust"]) {
  try {
    const { payload, seconds } = await post("/api/coding-challenge", { language, mode: "debug", difficulty: "beginner", topic: "arrays-strings", roleContext: "Practice debugging short array or string functions." });
    if (!payload.starterCode || payload.mode !== "debug") throw Error("Debugging code missing.");
    const execution = await post("/api/code-runner", { language, code: payload.starterCode, inputType: payload.inputType, outputType: payload.outputType, tests: payload.tests });
    const passed = execution.payload.results.filter((item) => item.passed).length;
    if (passed === payload.tests.length) throw Error("Original debugging code already passes every test.");
    console.log(JSON.stringify({ kind: "debug", language, title: payload.title, generationSeconds: seconds, executionSeconds: execution.seconds, passed, total: payload.tests.length, error: execution.payload.error || "" }));
  } catch (error) { failures++; console.log(JSON.stringify({ kind: "debug", language, error: error.message })); }
}
process.exitCode = failures ? 1 : 0;
