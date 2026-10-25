# Changelog

User-visible changes are recorded here. The API is experimental until 1.0.

## Unreleased

- Lead the website and README with a real interactive chart, selection-driven
  application content, and first-chart links. Add a focused natal/transit demo,
  reproducible screenshots/video, and a clickable-chart React tutorial/starter.

## 0.1.1

- Wait for npm registry indexing after publication before completing the GitHub
  Release. Retry transient registry/network failures for up to five minutes,
  retaining strict package identity and tarball integrity checks.
- Publish versioned browser, WordPress, and starter bundles through the automated
  release workflow, alongside the scoped npm package.

## 0.1.0

- Publish the library as `@yuzuwoeser/astr3`, with matching scoped imports and
  workspace/consumer validation. Keep browser filenames and release asset URLs
  stable, and default scoped npm publication to public access.

- Add shared release packaging for npm tarballs, versioned browser and WordPress
  ZIPs, complete framework/server starters, checksums and a source manifest.
  Add tag-triggered GitHub/npm publishing with exact-artifact rerun guards.
- Add an installable WordPress chart block and same-post shortcode with natal/
  transit JSON, local presets, validation feedback and accessible fallback.
- Lead integration pages with prebuilt installation, minimal usage and cleanup;
  add a three-route installation chooser and a phased stack coverage roadmap.

- Add syntax highlighting to website source tabs, setup snippets, and JSON
  previews, with colors for light and dark code panels and locally bundled grammars.

- Add versioned JSON appearance templates for natal and transit charts, synchronous
  SSR-safe resolvers with field-path errors and independent option copies, and the
  packaged `@yuzuwoeser/astr3/chart-template.schema.json` schema. Add homepage comparisons,
  a runnable template example with JSON downloads, and browser/PHP loading guidance.

- Fix GitHub Pages builds on Linux when dependencies ship lowercase license
  filenames, preserving their actual casing when collecting notices.

- Expand GitHub Pages into the ASTR3 project website with a dedicated playground,
  generated examples and integration guides for JavaScript, TypeScript, React,
  Vue.js, Svelte, Angular, PHP, WordPress, and Ruby on Rails.
- Add a self-hostable browser-module download with optional calculations and
  SVG/PNG exports. Example code and instructions live in `examples/`; website
  assets/build configuration move from `demo/` to `site/`.

- Add a GitHub Pages demo build at `/astr3/`, production desktop/mobile smoke
  tests, and automatic deployment from `main` after checks and history scanning
  pass. Support manual redeployment while keeping local development at `/`.

- Simplify getting started and complete public API coverage for models, helpers,
  events, calculation, and transit animation. Separate rendering internals from
  reference docs and update repository, reporting, and asset-link guidance.

- Adjust demo downloads to 800 × 800 for standard SVG and 1600 × 1600 for large
  SVG and PNG. Library export defaults remain unchanged.

- Add **Download large SVG** to the demo to retain
  more labels and degree/retrograde captions in crowded natal and transit charts.

- Add browser SVG and PNG export to natal and transit charts, with outlined text,
  full/current-view options, transparent backgrounds and demo download actions.
  Share wheel construction with the interactive renderer and load export fonts
  only on demand; unsupported custom text reports its missing characters.

- Match the supplied five-color logo palette in the header and footer, with a
  dark background for contrast. Add reusable outlined SVG logos and palette
  assets, and display the logo in the README.

- Adopt ASTR3 as the display name and a live-text Righteous Regular (400)
  wordmark. Bundle the original font locally with its SIL OFL license and retain
  lowercase `astr3` technical identifiers.

- Add individual celestial-body visibility controls, with separate natal/transit
  settings, All/None presets, and a `bodyVisibility` API. Hidden bodies and their
  connectors leave the wheel while their data and accessible selections remain.

- Add opt-in transit time-step animation with direct astronomical samples,
  adaptive retrograde trajectory resolution, Pause/Resume, reduced-motion support,
  and a reusable `createTransitAnimation` controller. The demo adds Year stepping
  with leap-day clamping. Batch wheel drawing to keep animated updates responsive.

- Add `layout: 'default' | 'alternative'` for natal and transit wheels. The
  alternative places houses outermost, zodiac second and celestial symbols
  inside, with separate inner aspect anchors and a shared demo selector.

- Validate the packed consumer using local peer archives and an empty npm cache,
  so fresh CI installations pass without cached registry metadata.

- Prepared the open source repository with public/synthetic fixtures, contributor
  guidance, agent integration examples and reproducible release privacy checks.

Initial implementation:

- Render Western natal wheels with Three.js and precomputed or locally calculated
  positions, actual house cusps, AC/MC axes, true lunar nodes and unknown-house support.
- Select planets, points, houses, aspects and supplied groups directly, with
  relationship highlighting, details/events and programmatic selection.
- Explore natal + transit bi-wheels with source-qualified selections and separate
  natal, cross-chart and transit aspect settings.
- Configure eleven aspect types, independent enablement and orbs, chart weight,
  themes, glyphs, layers and line styles.
- Keep markers at exact longitudes while fitting crowded symbols locally with
  bounded circular packing, zoom-aware text and selectable cluster badges.
- Use deterministic conjunction bows, touch/keyboard navigation, an accessible
  HTML object list and graceful WebGL failure handling.
- Consume typed ESM entry points for browser rendering, headless models and the
  optional Astronomy Engine adapter, with lifecycle cleanup and packed-consumer checks.
