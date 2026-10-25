# Working on ASTR3

These instructions apply to the entire repository. For agents integrating the
library into another application, start with [docs/agent-integration.md](docs/agent-integration.md).

Use **ASTR3** for the display name and project-name prose. Technical identifiers
such as package imports, URLs, CSS classes and JavaScript globals use `astr3`.
The demo wordmark is live text in Righteous Regular (400), with mint, sky blue,
lavender, coral and gold characters on a dark background. Match the palette in
`demo/public/brand/palette.json`; keep the locally bundled font and its SIL OFL
copyright/license notices together.

## Setup and checks

Use Node.js 24 LTS (supported minimum: 22.12.0) and npm. From the repository root:

```sh
npm ci
npm exec playwright -- install chromium
npm run dev
```

The demo URL is printed by Vite. Development-browser tests use port 4173; Pages
production smoke tests use port 4174. Stop unrelated servers on those ports before
running the corresponding suite. In Linux CI, install Chromium with
`npm exec playwright -- install --with-deps chromium`.

```sh
npm run typecheck      # TypeScript, including demo and tests
npm test              # Unit tests and independent numerical reference fixtures
npm run check         # Types, unit/reference tests, both builds, packed consumer
npm run test:browser  # Chromium desktop and mobile touch emulation
npm run test:pages    # Build and smoke-test the production demo beneath /astr3/
npm run format:check
```

Run focused checks while editing. Before completing a change, run the checks
appropriate to it. Public API, calculation, layout, picking, accessibility, and
lifecycle changes need their relevant tests. Renderer or demo changes also need
browser validation. A release needs the full sequence in
[docs/releasing.md](docs/releasing.md). Browser tests do not run inside `npm run check`.

## Where to work

| Path                                                         | Responsibility                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `src/model/`                                                 | Headless types, validation, aspects, houses, relationships, transit composition |
| `src/ephemeris/`                                             | Optional Astronomy Engine adapter, node and house calculations                  |
| `src/renderer.ts`                                            | Three.js wheel, HTML labels/accessibility, events, DOM/GPU lifecycle            |
| `src/transit-renderer.ts`                                    | Source-qualified transit API over the shared renderer                           |
| `src/transit-animation.ts`, `src/transit-sampling.ts`        | Transit animation lifecycle, sampling and cancellation                          |
| `src/wheel-drawing.ts`, `src/chart-export.ts`                | Shared drawing description and browser SVG/PNG export                           |
| `src/wheel-geometry.ts`                                      | Default/alternative ring geometry, source bands and annular house sectors       |
| `src/layout.ts`, `src/label-packing.ts`, `src/chart-text.ts` | Exact projection, bounded label placement, zoom-aware typography                |
| `src/picking.ts`                                             | Screen-space targets and overlapping selection candidates                       |
| `demo/`                                                      | Example application, forms, tooltips, explanations and time controls            |
| `tests/unit/`, `tests/browser/`, `tests/fixtures/`           | Behavioral tests and public/synthetic reference data                            |
| `scripts/`                                                   | Builds and package consumer validation                                          |
| `docs/`                                                      | Public contracts, integration and calculation explanations                      |

## Contracts to preserve

- `astr3/model` must import no DOM, Three.js, or ephemeris code. Importing the
  main entry must remain SSR-safe; mounting needs a browser and WebGL 2.
- Use degrees for positions and orbs. Keep exact astronomical positions separate
  from displaced labels. Never move a longitude to solve a visual collision.
- Preserve stable IDs. Transit selections require `chart: 'natal' | 'transit'`,
  or `chart: 'cross'` for cross aspects. Never expose internal scoped renderer IDs.
- Unknown birth time must not invent houses or axes. Actual cusps may be unequal.
  AC/MC bodies and independently supplied angles must agree when both are used.
- Omitted aspects calculate; supplied `[]` means none. Supplied aspects remain
  authoritative across orb changes, but disabled types are filtered. Keep
  enablement separate from layer visibility, and retain original inputs for re-enabling.
- Validation failures must leave the previous chart intact. Models must not
  mutate caller data. Metadata stays opaque and is retained by reference.
- Dispose owned DOM/GPU resources, observers, listeners and queued frames. Preserve
  accessible selection when WebGL is unavailable. Do not add network requests,
  storage, telemetry or global listeners without a concrete requirement.
- Do not replace the bounded circular packing solver with greedy placement or
  unbounded leader lines. Dense views must retain selectable dots/list entries.

Read [docs/api.md](docs/api.md), [docs/transits.md](docs/transits.md), and
[docs/calculations.md](docs/calculations.md) before changing their contracts.
Keep application explanations and framework-specific wrappers outside the core.

## Data, documentation and commits

Use invented positions or documented public reference dates/locations in examples,
tests, screenshots and issues. Do not copy a user's birth data, local paths,
credentials, logs or agent conversations into tracked files. Numerical reference
fixtures have independent provenance; do not relabel their input while retaining
old expected results. Optional Python regeneration is not part of normal setup.

Update affected docs and examples with API/behavior changes. Add an Unreleased
changelog entry for user-facing changes. Keep `llms.txt` links current. The packed
consumer check validates exports and declarations; extend it for new entry points.
Do not hand-edit `dist/`, `demo-dist/` or `node_modules/`.

When implementation is authorized, include a local Git commit. Review the final
diff, run appropriate checks, commit only task changes, preserve unrelated work,
and use a descriptive message. Report the commit hash and validation results.
If blocked, explain why and explicitly state that changes remain uncommitted.
Do not push or publish unless the user asks.
