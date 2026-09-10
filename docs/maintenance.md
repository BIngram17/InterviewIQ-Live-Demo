# September 2026 maintenance

Reviewed the interview, coding, resume, shared UI, storage, upload/import,
model integration, scoring, execution, and deployment paths.

## Corrected issues

- Short interview answers silently substituted a sample answer. They now require
  a complete candidate response before requesting feedback.
- Model timeouts expired only through response headers. The timeout now remains
  active while reading and validating the response body.
- Job-import timeouts also remain active through HTML body reading.
- JSON request validation now checks actual UTF-8 body size and rejects null,
  array, scalar, malformed, and oversized payloads.
- Imported numeric HTML entities outside Unicode range no longer crash parsing;
  ambiguous IPv4-mapped IPv6 addresses are rejected.
- Late resume responses are discarded when the target, resume, profile, or
  active application changes during the request.
- Unverified rewrites must include an explicit candidate-information template.
  Rubric fallbacks no longer recommend work for satisfied criteria or assign
  made-up point increases.
- Interview storage writes report capacity failures, and Reset clears the job URL.
- Saved coding challenges validate required arrays and bound the restored step.
  Running tests locks the editor, and final review requires a passing test set.
- Compatible dependency patches address published framework/image/XML issues.

## Removed unused code

- The obsolete local role profiles, fixed question bank, and interview builder.
- An unused authentication scaffold.
- The obsolete monolithic resume-review prompt.
- A hard-coded interview score fallback.

The README describes the current application. Historical Git commits are
preserved. Application AI features and provider names remain documented because
they describe actual runtime behavior.

## Verification limits

Tests and code review do not establish that every possible defect is absent.
Live generation depends on provider capacity and generated challenge quality.
Passing supplied practice cases does not prove correctness for all inputs.
The local benchmark and its limitations are documented in performance.md.
