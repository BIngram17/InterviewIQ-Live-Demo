# Performance and verification evidence

Measured on September 10, 2026. Reproduce with:

```sh
npm --prefix api test
npm run lint
npm run test:e2e
npm run build
node scripts/benchmark.mjs
```

## Local backend benchmark

The benchmark starts a loopback HTTP adapter around the application's execution
request validator, five-language harness generator, and ten-criterion resume
normalizer/scorer. Each measured request exercises all three functions.
It does not call the AI provider or execute submitted code.

Environment: Windows, Node.js v24.15.0, Intel Core i7-1355U, 12 logical processors.
Each run used 50 warm-up requests followed by 1,000 requests from 25 concurrent
workers. Language values rotate through JavaScript, Python, Java, C#, and Rust.

| Run | Requests | Concurrent workers | Failures | p50 | p95 | p99 | Throughput |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1,000 | 25 | 0 | 10.74 ms | 20.28 ms | 24.58 ms | 2,247.21 req/s |
| 2 | 1,000 | 25 | 0 | 9.78 ms | 20.08 ms | 25.51 ms | 2,396.83 req/s |
| 3 | 1,000 | 25 | 0 | 9.42 ms | 20.70 ms | 24.23 ms | 2,395.81 req/s |

These are short local component benchmarks, not sustained production capacity.
They exclude Azure routing, cold starts, rate limiting, model inference, external
sandbox execution, and Internet latency. Do not describe these figures as live
AI response times or production requests per second. No comparable pre-change
baseline was captured, so no latency reduction percentage is claimed.

## Verification scope

Verified in this change: 57 API/unit tests and 10 browser end-to-end tests passed.
ESLint reported zero warnings/errors, and the Next.js static production build passed.

The API suite covers model retry/fallback behavior, incomplete responses, response
body timeouts, JSON request limits, coding contracts, source harnesses, editor
behavior, scoring consistency, evidence handling, and debugging starter code.
Browser tests cover interview context, refusal to substitute sample answers,
debugging progression and reset, saved history, Resume Studio, and mobile layout.
Browser workflow tests mock AI responses; the JavaScript test runner executes
the fixture code in the restricted browser frame.

## Defensible resume statements

- Benchmarked backend validation, code-harness generation, and resume scoring
  across 3,000 local HTTP requests at 25 concurrent workers, with zero failures
  and p95 latency below 21 ms.
- Built resume-aware interview preparation and test-gated debugging practice
  across five programming languages, with saved progress and contextual coaching.
- Added regression coverage for stalled AI response bodies, malformed requests,
  resume evidence, and debugging workflows.

In an interview, explain the local adapter and excluded external services when
using the benchmark numbers. Avoid saying that production AI requests support
25 concurrent users based on this test.
