# Security policy

Only the latest 0.1.x release is maintained for security fixes. There is no
guaranteed response time. The API is experimental and versions before 1.0 may
change.

## Report privately

Use the repository's **Security → Report a vulnerability** feature when available:
[private reporting](https://github.com/yuzuwoeser/astr3/security/advisories/new).
This requires maintainers to enable private vulnerability reporting after the
GitHub repository is created; this file does not enable it.

If that feature is unavailable, open a public issue asking for a private reporting
channel **without disclosing the vulnerability, exploit, credentials or personal
chart data**. Wait for a private channel before sharing sensitive details. Public
issues are suitable for ordinary bugs reproduced with synthetic data.

Include the affected version, runtime/browser, impact and a minimal reproduction.
Use invented chart data. Share secrets only to identify a leak through the agreed
private channel, and rotate exposed credentials promptly.

## Scope and privacy

The library renders caller-supplied data; the optional Astronomy Engine adapter
calculates locally. First-party code includes no account service, telemetry or
chart storage. Host applications control persistence, network access and custom
HTML. Treat names, metadata and interpretation text as untrusted application data;
use `textContent` for plain text rather than interpolating it into HTML.

Release checks scan Git history and distributable contents for secrets and review
fixtures for personal information. Automated secret detection cannot establish
that arbitrary chart coordinates or screenshots are safe to publish. Review
those manually and keep private datasets outside the repository.
