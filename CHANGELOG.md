# Changelog

User-visible changes are recorded here. The API is experimental until 1.0.

## Unreleased

- Adopt ASTR3 as the display name and a live-text Righteous Regular (400)
  wordmark with an accented green 3. Bundle the original font locally with
  its SIL OFL license and retain lowercase `astr3` technical identifiers.

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

## 0.1.0

Initial implementation; package publication is pending.

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
