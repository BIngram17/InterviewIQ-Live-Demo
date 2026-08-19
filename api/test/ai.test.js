import assert from "node:assert/strict";
import test from "node:test";

process.env.GEMINI_API_KEY = "test-key";
process.env.GEMINI_RETRY_BASE_MS = "1";
process.env.GEMINI_ATTEMPT_TIMEOUT_MS = "100";
process.env.GEMINI_TOTAL_TIMEOUT_MS = "500";

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
  });

  assert.deepEqual(result, { score: 8 });
  assert.match(request.url, /gemini-3\.6-flash:generateContent$/);
  assert.equal(request.options.headers["x-goog-api-key"], "test-key");
  const body = JSON.parse(request.options.body);
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.equal(body.generationConfig.maxOutputTokens, 300);
  assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, "low");
  assert.equal(body.generationConfig.temperature, undefined);
  assert.match(body.system_instruction.parts[0].text, /untrusted data/);
  assert.match(body.contents[0].parts[0].text, /"answer":"Example"/);
});

test("completeJson repairs common JSON formatting mistakes", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: '```json\n{"coverLetter":"First line\nSecond line","notes":["Review",],}\n```' }] } }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  const result = await completeJson({ system: "Return JSON.", data: {} });

  assert.deepEqual(result, { coverLetter: "First line\nSecond line", notes: ["Review"] });
});

test("completeJson retries malformed model output with the fallback", async () => {
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(url);
    const content = urls.length === 1 ? '{"coverLetter":' : '{"coverLetter":"Recovered"}';
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: content }] } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await completeJson({ system: "Return JSON.", data: {} });

  assert.deepEqual(result, { coverLetter: "Recovered" });
  assert.equal(urls.length, 2);
  assert.match(urls[1], /gemini-3\.5-flash-lite:generateContent$/);
});

test("completeJson retries valid JSON that fails response-shape validation", async () => {
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(url);
    const content = urls.length === 1
      ? '{"score":8,"strengths":[]}'
      : '{"score":8,"strengths":["Specific example"]}';
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: content }] } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await completeJson({
    system: "Return feedback.",
    data: {},
    validate: (value) => Array.isArray(value?.strengths) && value.strengths.length > 0,
  });

  assert.deepEqual(result, { score: 8, strengths: ["Specific example"] });
  assert.equal(urls.length, 2);
  assert.match(urls[1], /gemini-3\.5-flash-lite:generateContent$/);
});

test("completeJson retries a transient outage using the fallback before retrying primary", async () => {
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(url);
    if (urls.length < 3) return new Response("{}", { status: 503 });
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"recovered":true}' }] } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const result = await completeJson({ system: "Return JSON.", data: {} });

  assert.deepEqual(result, { recovered: true });
  assert.equal(urls.length, 3);
  assert.match(urls[0], /gemini-3\.6-flash:generateContent$/);
  assert.match(urls[1], /gemini-3\.5-flash-lite:generateContent$/);
  assert.match(urls[2], /gemini-3\.6-flash:generateContent$/);
});

test("completeJson gives the fallback a fresh timeout after a stalled primary", async () => {
  const urls = [];
  globalThis.fetch = (url, options) => {
    urls.push(url);
    if (urls.length === 1) {
      return new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      });
    }
    return Promise.resolve(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"fallback":true}' }] } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
  };

  const result = await completeJson({ system: "Return JSON.", data: {} });

  assert.deepEqual(result, { fallback: true });
  assert.equal(urls.length, 2);
  assert.match(urls[1], /gemini-3\.5-flash-lite:generateContent$/);
});

test("completeJson can use the faster fallback model first for latency-sensitive requests", async () => {
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = url;
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"review":"ready"}' }] } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const result = await completeJson({ system: "Return a review.", data: {}, preferFallback: true });

  assert.deepEqual(result, { review: "ready" });
  assert.match(requestedUrl, /gemini-3\.5-flash-lite:generateContent$/);
});

test("completeJson translates Gemini rate limits into a safe public error", async () => {
  globalThis.fetch = async () => new Response("{}", { status: 429 });

  await assert.rejects(
    completeJson({ system: "Return JSON.", data: {} }),
    (error) => error instanceof ApiError && error.status === 429 && /Try again shortly/.test(error.message),
  );
});

test("completeJson returns a clear 503 after exhausting transient retries", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response("{}", { status: 503 });
  };

  await assert.rejects(
    completeJson({ system: "Return JSON.", data: {} }),
    (error) => error instanceof ApiError && error.status === 503 && /after retrying/.test(error.message),
  );
  assert.equal(calls, 3);
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
