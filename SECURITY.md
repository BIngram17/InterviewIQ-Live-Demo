# Security Policy

## Reporting a Vulnerability

Please report suspected vulnerabilities privately through GitHub rather than
opening a public issue containing exploit details or credentials.

Include:

- A description of the issue and its potential impact
- Reproduction steps or a minimal proof of concept
- The affected route, browser, or environment
- Any recommended mitigation

Never include real API tokens, private user data, or other credentials in a
report.

## Demo Security Model

InterviewIQ is a public portfolio demo. It uses server-side model credentials,
input validation, prompt boundaries, response normalization, request limits,
Content Security Policy, and sandboxed browser execution. Public access and AI
output still carry residual risk, so this repository should not be treated as
a complete production security baseline for sensitive or regulated data.
