import assert from "node:assert/strict";
import test from "node:test";

process.env.GEMINI_API_KEY = "test-key";

const { ApiError, completeJson } = await import("../src/lib/ai.js");
const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("completeJson sends a structured Gemini request and parses its response", async () => {
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"score":8}' }] } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const result = await completeJson({
    system: "Return a score.",
    data: { answer: "Example" },
    maxTokens: 300,
    temperature: 0.4,
  });

  assert.deepEqual(result, { score: 8 });
  assert.match(request.url, /gemini-3\.6-flash:generateContent$/);
  assert.equal(request.options.headers["x-goog-api-key"], "test-key");
  const body = JSON.parse(request.options.body);
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.equal(body.generationConfig.maxOutputTokens, 300);
  assert.match(body.system_instruction.parts[0].text, /untrusted data/);
  assert.match(body.contents[0].parts[0].text, /"answer":"Example"/);
});

test("completeJson translates Gemini rate limits into a safe public error", async () => {
  globalThis.fetch = async () => new Response("{}", {
    status: 429,
    headers: { "retry-after": "30" },
  });

  await assert.rejects(
    completeJson({ system: "Return JSON.", data: {} }),
    (error) => error instanceof ApiError && error.status === 429 && /30 seconds/.test(error.message),
  );
});

test("completeJson rejects incomplete Gemini responses", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ candidates: [] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  await assert.rejects(
    completeJson({ system: "Return JSON.", data: {} }),
    (error) => error instanceof ApiError && error.status === 502,
  );
});
