# Security policy

Only the latest 0.1.x release is maintained for security fixes. There is no
guaranteed response time. The API is experimental and versions before 1.0 may
change.

## Report privately

Private vulnerability reporting is not currently enabled for this repository.
Open an [issue](https://github.com/yuzuwoeser/astr3/issues) asking for a private
reporting channel **without disclosing the vulnerability, exploit, credentials,
or personal chart data**. Wait for a private channel before sharing sensitive
details. If maintainers enable **Security → Report a vulnerability**, use that
private channel instead. Public issues are suitable for ordinary bugs reproduced
with synthetic data.

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
