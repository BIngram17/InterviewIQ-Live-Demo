import { createServer } from "node:http";
import { once } from "node:events";
import { performance } from "node:perf_hooks";
import os from "node:os";
import { validateExecutionRequest, buildExecutionSource } from "../api/src/lib/code-execution.js";
import { normalizeEvaluationCriteria, scoreEvaluationCriteria, resumeScoringRubric } from "../api/src/lib/resume-review.js";

// Measures real validation/scoring/harness functions behind a local HTTP adapter.
// Excludes AI providers, code execution, Azure hosting, and Internet latency.
const requests = 1000;
const concurrency = 25;
const languages = ["javascript", "python", "java", "csharp", "rust"];
const criteria = resumeScoringRubric.flatMap((rubric, i) => [0, 1].map((j) => ({
  id: `criterion-${i}-${j}`, category: rubric.category, requirement: "Verified delivery experience",
  importance: "required", status: "partial", projectedStatus: "met",
  evidence: "Delivered software", explanation: "Provide more specific evidence.",
})));
const payload = {
  language: "javascript", code: "function solution(input) { return input; }",
  inputType: "integer-array", outputType: "integer-array",
  tests: [{ input: [1, 2, 3], expected: [1, 2, 3] }, { input: [], expected: [] }, { input: [0], expected: [0] }],
};
const server = createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const valid = validateExecutionRequest(body);
    if (!valid) throw Error("Invalid request");
    const source = buildExecutionSource(valid, "__BENCH__");
    const score = scoreEvaluationCriteria(normalizeEvaluationCriteria(criteria));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ score: score.score, sourceBytes: Buffer.byteLength(source) }));
  } catch {
    res.writeHead(400); res.end("{}");
  }
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const url = `http://127.0.0.1:${server.address().port}`;
const samples = [];
let failures = 0;
let index = 0;
const request = async (i) => {
  const start = performance.now();
  try {
    const response = await fetch(url, { method: "POST", body: JSON.stringify({ ...payload, language: languages[i % languages.length] }) });
    const result = await response.json();
    if (!response.ok || result.score !== 71 || !result.sourceBytes) failures++;
  } catch { failures++; }
  return performance.now() - start;
};
try {
  for (let i = 0; i < 50; i++) await request(i);
  failures = 0;
  const started = performance.now();
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (index < requests) { const i = index++; samples.push(await request(i)); }
  }));
  const elapsedMs = performance.now() - started;
  samples.sort((a, b) => a - b);
  const percentile = (p) => Number(samples[Math.ceil(samples.length * p) - 1].toFixed(2));
  console.log(JSON.stringify({
    measuredAt: new Date().toISOString(), node: process.version, platform: os.platform(),
    cpu: os.cpus()[0].model, cpuCount: os.cpus().length,
    scope: "Local HTTP harness: execution validation, five-language harness generation, ten-criterion resume scoring. No AI inference, sandbox execution, Azure, or Internet.",
    requests, concurrency, warmup: 50, failures, elapsedMs: Number(elapsedMs.toFixed(2)),
    requestsPerSecond: Number((requests / (elapsedMs / 1000)).toFixed(2)),
    p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99),
  }, null, 2));
} finally { server.closeAllConnections(); server.close(); }
