# Contributing to ASTR3

ASTR3 is an MIT-licensed TypeScript library. Issues and pull requests are welcome.
The 0.x API may change; discuss a substantial public API change in an issue first.
Do not include private birth information in reports, screenshots or fixtures.

## Start locally

Use **Node.js 24 LTS**, matching CI. Node 22.12.0 or newer is supported by the
package. npm and Git are required; Python and an ephemeris service are not.

```sh
git clone https://github.com/yuzuwoeser/astr3.git
cd astr3
npm ci
npm exec playwright -- install chromium
npm run dev
```

Open the Vite URL. Choose a synthetic or public calculated preset, then try
selecting a body, aspect, house or supplied group. The example application owns
forms, tooltip text and time controls; the library owns rendering and selection.

## Make and verify a change

Create a branch from `main`. Keep a change focused and preserve existing local
work. Read [AGENTS.md](AGENTS.md) for source boundaries and invariants, whether you
work manually or with a coding agent.

```sh
npm run typecheck
npm test
npm run build
npm run build:demo
npm run test:package
npm run test:browser
npm run format:check
```

`npm run check` combines the first five commands. The package check installs the
actual tarball into an isolated consumer and checks ESM imports, SSR-safe imports
and TypeScript declarations. It packs the installed peers alongside ASTR3 and
installs those local archives offline with an isolated empty npm cache. It does
not depend on cached registry metadata. Run `npm ci` first to install the peers.

Browser tests start Vite on **127.0.0.1:4173**, exercising Chromium desktop and
mobile touch emulation with software WebGL. Stop an unrelated server on that port
first: local runs may reuse an existing server. Linux needs browser OS packages:
`npm exec playwright -- install --with-deps chromium`. A desktop-only pinch test
is intentionally skipped; physical devices, Firefox and Safari are not covered.
Screenshots and failure traces stay in ignored `test-results/`.

For a focused run, use `npm test -- tests/unit/layout.test.ts` or
`npm run test:browser -- tests/browser/transits.spec.ts --project=chromium`.
`npm run format` applies Prettier; review its diff before committing.

Add tests for changed behavior and regressions rather than duplicating the
implementation. Keep calculation reference tests independent of the algorithm
under test. Fixtures and optional regeneration provenance are documented in
[calculations](docs/calculations.md).

## Submit a pull request

- Explain the observable problem and resulting behavior. Include a small public
  or synthetic reproduction for fixes.
- Document public options, event/data changes, calculation conventions and limits.
- List validation results, including anything skipped or still unverified.
- Include screenshots for visible changes using synthetic/public chart data.
- Keep generated builds, local settings, credentials and personal data out of Git.

Use descriptive commits. Implementation work should include a local commit after
checks and diff review. A push or publication still needs the repository owner's
authorization. GitHub workflows run formatting, types, tests, builds, consumer
validation and a full-history secret scan.

## Documentation and assets

Keep examples runnable with invented positions or documented public reference
dates/locations. Describe public behavior in the [API reference](docs/api.md)
and implementation detail in [architecture](docs/architecture.md). Update
`llms.txt` when navigation changes. Check relative links in the packed docs as
well as the checkout: demo assets and development scripts are not packaged.

The [brand notes](https://github.com/yuzuwoeser/astr3/blob/main/demo/public/brand/README.txt)
record wordmark colors, SVG assets, and font attribution. The
[export font guide](https://github.com/yuzuwoeser/astr3/blob/main/scripts/export-fonts/README.md)
describes optional outline regeneration and provenance. Keep copyright/license
notices with redistributed fonts and outlines; do not regenerate them for a
prose-only change.

Report vulnerabilities using [SECURITY.md](SECURITY.md), not a public issue with
an exploit or secret. See [the release checklist](docs/releasing.md) for artifact
and privacy checks before a public release.
