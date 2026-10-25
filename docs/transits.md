# Transit bi-wheel API

Use `createTransitChart` to mount a natal + transit wheel, or `createTransitModel`
for headless data. Natal houses and orientation stay fixed as transit time
changes. Both sides accept precomputed `ChartInput`; calculation is optional.
For shared renderer settings, export, and keyboard interaction, see the
[main API reference](api.md).

## Start with a transit wheel

This browser example uses invented positions. Mount `#wheel` with a nonzero
width before running it:

```ts
import { createTransitChart } from '@yuzuwoeser/astr3';

const host = document.querySelector<HTMLElement>('#wheel');
if (!host) throw new Error('Mount #wheel first.');

const natal = {
  bodies: [
    { id: 'sun', name: 'Sun', longitude: 0 },
    { id: 'mars', name: 'Mars', longitude: 120 },
  ],
};
const transit = {
  bodies: [
    { id: 'sun', name: 'Sun', longitude: 30 },
    { id: 'mars', name: 'Mars', longitude: 122 },
  ],
};
const wheel = createTransitChart(host, {
  data: { natal, transit },
  orbs: { cross: { conjunction: 5 } },
});
const unsubscribe = wheel.on('selection', ({ details }) => console.log(details));
wheel.select({ kind: 'body', chart: 'transit', id: 'mars' });
wheel.updateTransit({ bodies: [{ id: 'mars', name: 'Mars', longitude: 123 }] });

// Call from your application's unmount handler.
function unmount() {
  unsubscribe();
  wheel.dispose();
}
```

## Data and identity

`TransitChartInput` is `{ natal: ChartInput, transit: ChartInput,
crossAspects?: readonly CrossAspectInput[] }`. IDs must be unique within each
source chart; the same ID may appear in both. Transit houses/axes are ignored.
Transit bodies derive `natalHouse` from natal cusps, or `undefined` when unknown;
their `house` is not populated from transit-time cusps.

`TransitChartModel` is frozen and exposes `natal: ChartModel`, `transit` (a
`ChartModel` whose bodies are `TransitBody[]`), and `crossAspects`. Each source
retains its enabled intra-chart aspects and supplied groups. Cross aspects are
calculated for every natal/transit pair, including identically named bodies.
All eleven [aspect types and defaults](api.md#aspects-and-enablement), inclusive
boundaries, and closest-enabled-angle rules match natal models. Five major types
start enabled and six minor types start disabled in each family.

Omitted aspect lists calculate contacts. Supplied lists, including `[]`, are
authoritative: orb edits do not filter them, but disabled types are excluded after
validation. Dependent supplied groups are temporarily omitted as in natal models.
Keep original inputs to restore them when re-enabling types.

`CrossAspectInput` is `{ id, type, bodyRefs: [{ chart: 'natal', id },
{ chart: 'transit', id }], metadata? }`. Either endpoint order is accepted; each
reference must resolve to one body from a different side. Cross IDs must be
nonempty and unique within their family. A derived `CrossAspect` adds exact
`angle`, actual `separation`, and absolute `orb` in degrees. Applying/separating,
cross-chart pattern groups, and automatic pattern detection are not calculated.

### Headless helpers

Import these functions and data types from `@yuzuwoeser/astr3/model` or `@yuzuwoeser/astr3`:

| Function                                                                        | Parameters and result                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createTransitModel(input, options?): TransitChartModel`                        | `TransitChartInput` and optional `TransitModelOptions` with family-specific orbs/enablement; defaults to `{}`. Validates, normalizes, and freezes the model without mutating input. Invalid data/settings throw `ChartDataError`. Metadata stays by reference. |
| `getTransitSelectionDetails(model, selection): TransitSelectionDetails \| null` | Immediate relationships for a source-qualified selection; unknown references return `null`.                                                                                                                                                                    |
| `transitAspects(model): ScopedAspect[]`                                         | All enabled natal, transit, and cross aspects, each with `chart` and source-qualified `bodyRefs`. Does not change the model.                                                                                                                                   |
| `transitSelectionKey(selection): string`                                        | Stable source/kind/ID key; does not check existence.                                                                                                                                                                                                           |
| `bodyReferenceKey(reference): string`                                           | Stable source/body-ID key; does not check existence.                                                                                                                                                                                                           |

## Options

- `layout`: `'default'` or `'alternative'` (default: `'default'`). The alternative places natal houses outermost, zodiac second, transit symbols inside its inner ruler, then a second natal ruler and natal symbols. Both project to a separate shared inner aspect circle. Runtime switching preserves selections and view. See [layout presets](api.md#layout-presets).
- `orbs: { natal?, cross?, transit? }`: independent partial aspect-to-degree maps. Each starts with the [natal orb defaults](api.md#aspects-and-enablement). Limits accept finite values from 0° through 180°. Nested updates patch by family and aspect type.
- `enabledAspects: { natal?, cross?, transit? }`: independent partial aspect-to-boolean maps (`TransitAspectEnabledConfig`). For example, `wheel.setOptions({ enabledAspects: { cross: { quincunx: true, square: false } } })` changes only those cross-family flags. Disabled aspects leave the model, wheel, explorer, and relationship details; removed selections clear. Orb changes do not toggle enablement. The headless `createTransitModel(data, options)` accepts the same family settings through `TransitModelOptions`.
- `layers`: the existing zodiac, houses, axes, bodies, aspects, groups, and degrees switches, plus `natalBodies`, `transitBodies`, `natalAspects`, `crossAspects`, and `transitAspects`. Both body sets and cross aspects start visible; natal and transit-to-transit aspects start hidden. Master `bodies`/`aspects` switches apply to both sides/all families. Visibility does not remove data or accessible list entries.
- `glyphs: { natal?: Record<string, string>, transit?: Record<string, string> }`: source-specific overrides using original body IDs.
- `bodyVisibility: { natal?: BodyVisibility, transit?: BodyVisibility }`, typed as `TransitBodyVisibility`: independent body-ID-to-boolean maps. For example, `wheel.setOptions({ bodyVisibility: { transit: { moon: false } } })` hides the transiting Moon while retaining the natal Moon. Nested patches merge by side and ID; omitted IDs default to visible. Hiding a body also hides its connected aspects in every family and any group outline involving it. The underlying bodies, aspects, groups, selection, and accessible entries remain intact. Settings survive data/time changes, animation, and layout changes. The family/master body and aspect layers still apply independently. See [body visibility](api.md#options) for validation and axis-guide behavior.
- `transitColor`: transit glyph/anchor tint; defaults to the theme's group color. Natal anchors are filled circles, transit anchors outlined diamonds. Text descriptions and list headings identify their source independently of color.
- Existing `chartWeight`, `theme`, `lineStyles`, `selectionEffects`, `dimUnrelated`, and `ariaLabel` work across the wheel. Aspect line styles are keyed by aspect type and apply to every family.

## Methods and events

`createTransitChart(container: HTMLElement, options: TransitChartOptions): TransitChart`
mounts the shared renderer. The `model`, `selection`, `element`, and `error`
properties follow the natal API with transit types.

| Method                                                                                  | Behavior                                                                                                                     |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `update(data: TransitChartInput): void`                                                 | Replace both sides atomically.                                                                                               |
| `updateTransit(data: ChartInput): void`                                                 | Replace only transit input, preserving the natal model object.                                                               |
| `setOptions(options: Partial<Omit<TransitChartOptions, 'data'>>): void`                 | Patch settings, merging source/family maps by key.                                                                           |
| `select(reference: TransitSelection \| null): void`                                     | Select a source-qualified object, or clear with `null`. Unknown references/combinations throw `RangeError`.                  |
| `clearSelection()`, `zoomBy(factor)`, `resetView()`, `on(event, listener)`, `dispose()` | Same signatures and lifecycle as [natal methods](api.md#renderer).                                                           |
| `exportSvg(options?)`, `exportPng(options?)`                                            | Same [options and limits](api.md#svg-and-png-export). Capture the displayed sample at call time, including during animation. |

Data/options updates retain the camera and still-existing selections. Derived
aspect IDs are stable by source-qualified endpoints and type; a disappearing
selection clears. Invalid updates leave the prior chart intact. Selection,
navigation, visibility, and aspect settings never call a provider.

### Selections and relationship details

`TransitSelection` requires a `chart` source:

| Kind            | Allowed source                       |
| --------------- | ------------------------------------ |
| `body`, `group` | `'natal'` or `'transit'`             |
| `house`         | `'natal'`                            |
| `aspect`        | `'natal'`, `'transit'`, or `'cross'` |

`TransitSelectionDetails` contains `selection`, `object`, `bodies`, `houses`,
`aspects`, and `groups`, as in [natal selection details](api.md#events-and-details).
`object` includes its source. `bodies` are `ScopedBody[]`, `aspects` are
`ScopedAspect[]` (with `bodyRefs`), and `groups` are `ScopedGroup[]`. `houses` are
natal `House[]`; house selection includes both natal and transit occupants.
Expansion is immediate, not recursive. Internal renderer IDs are never exposed.

### Events

Subscribe through `wheel.on(event, listener)`; each subscription returns an
unsubscribe function. `TransitChartEvents` uses these payloads:

| Event                      | Payload                                                                                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selection`                | `{ selection: TransitSelection \| null, details: TransitSelectionDetails \| null, source }`. Source is `pointer`, `keyboard`, `programmatic`, or `update`. |
| `hover`                    | `{ selection: TransitSelection \| null, details: TransitSelectionDetails \| null, x, y }`; client CSS pixels as in the natal API.                          |
| `update`                   | `{ model: TransitChartModel }` after data/options changes.                                                                                                 |
| `view`, `error`, `dispose` | Same payloads and timing as [natal events](api.md#events-and-details).                                                                                     |

Selection listeners can run on programmatic selection and selected-data refresh.
Render idempotently; avoid calling `select` unconditionally inside a listener.

## Layout and accessibility

For reusable presentation presets, use a `kind: 'transit'` JSON template with
`resolveTransitChartTemplate` from `@yuzuwoeser/astr3` and spread the returned options into
`createTransitChart`. It supports source-specific glyphs/body visibility, transit
layers, and `transitColor`; data, orbs, enablement, and accessible names remain
application options. See [JSON templates](api.md#json-templates) for the full
schema, defaults, errors, and override behavior, and the
[runnable example](https://yuzuwoeser.github.io/astr3/examples/json-templates/).

The default layout places transit labels outside the natal zodiac. The
alternative places houses outermost, zodiac second, then transit/natal symbol
bands and a shared inner aspect circle. Natal anchors are filled circles and
transit anchors outlined diamonds; text and list headings also identify sources.
Coincident anchors open a chooser. Houses/axes come solely from natal data;
unknown time does not fabricate them.

Both modes use [bounded labels, count badges, keyboard selection, and an HTML
object list](api.md#input-and-accessibility). Overlapping conjunction anchors
suppress their connector while keeping the aspect inspectable through the
list/API. Hiding a body leaves its data and accessible entry intact. For dense
phone views, zoom in or use **Explore chart objects**.

## Animated time steps

`createTransitAnimation(chart: TransitChart, calculateTransits: TransitCalculator, options?: TransitAnimationOptions): TransitAnimation` is an opt-in browser controller exported from `@yuzuwoeser/astr3`. Inject a calculator with the same signature as the optional adapter's `calculateTransits`; the controller does not import Astronomy Engine. Existing `updateTransit` calls remain immediate.

```ts
import { createTransitAnimation } from '@yuzuwoeser/astr3';
import { createAstronomyProvider } from '@yuzuwoeser/astr3/ephemeris';

const provider = createAstronomyProvider();
// `chart` is an existing TransitChart, currently displaying the `from` time.
const animation = createTransitAnimation(chart, provider.calculateTransits);
const unsubscribe = animation.on('progress', ({ state }) => {
  console.log(state.currentTime, state.progress);
});
await animation.play({ from: '2024-04-08T18:00:00Z', to: '2024-04-15T18:00:00Z' });
// Pause/Resume controls call animation.pause() and animation.resume().
// Before an application-owned immediate data update, call animation.cancel().
unsubscribe();
animation.dispose(); // Also disposed automatically with its chart.
```

- `play({ from, to })` accepts `Date` or ISO timestamps with an explicit timezone, in either direction, within 1900–2100 and at most 366 days apart. It resolves on completion or cancellation, rejects on calculation/validation failure, and replaces any prior run. Invalid ranges throw before interrupting a valid run. For a new step during playback, use `animation.state.currentTime` as `from`.
- `pause()` freezes the displayed time; `resume()` continues it. `cancel()` stops at the last displayed snapshot. `dispose()` cancels requests/frames, removes visibility and motion listeners, and unsubscribes from the chart. Disposal is idempotent; later mutations throw.
- `state` is a frozen snapshot containing `status`, `from`, `to`, `currentTime` (ISO strings or `null`), `progress` (0–1), and `durationMs`. Status is `idle`, `preparing`, `playing`, `buffering`, `paused`, `completed`, `error`, or `disposed`. Time is initially unknown until the controller applies its first sample.
- The controller honors `prefers-reduced-motion: reduce` by applying only the endpoint. A preference change during playback finishes at that endpoint. Hidden pages suspend time; user pauses remain paused when the page returns. Settings and camera changes remain available during playback. Applications must cancel before replacing chart data themselves.

Every displayed timestamp is calculated directly: longitude, speed, retrograde flags, aspects, picking, and accessible details describe the same instant. Labels still use bounded collision packing, independently of exact longitude markers. No endpoint interpolation or per-frame longitude displacement is used to create motion.

`TransitCalculator` accepts `(request: { utc: Date | string }, options?:
{ signal?: AbortSignal })` and returns `Promise<ChartInput>`. Body IDs must remain
stable throughout a run. Honor the signal to avoid obsolete work; revision
checks also discard results from calculators that ignore it.

`TransitAnimationOptions.outerBodyIds` identifies bodies whose paths retain full
detail for steps longer than seven days. Defaults are `jupiter`, `saturn`,
`uranus`, `neptune`, and `pluto`. Animation targets 0.05° trajectory resolution;
this is not an additional astronomical accuracy guarantee. Slow calculations
extend elapsed time rather than skipping samples. Intervals needing more than
8,192 frames fail with a request for a shorter interval. Duration preferences,
sampling rules, and buffering are explained in [animation architecture](architecture.md#animation-sampling).

### Animation events

`TransitAnimationEvents` is independent of chart events:

| Event      | Payload                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------ |
| `state`    | `TransitAnimationState` directly; reports status, interval, and planned-duration changes.  |
| `progress` | `{ state: TransitAnimationState, data: ChartInput }` after a calculated sample is applied. |
| `error`    | `{ message: string, cause: unknown }`; playback stops and the last valid chart remains.    |

Subscriptions return unsubscribe functions. Handle rejected `play()` promises as
well as displaying errors. `TransitAnimationStatus` is the union of status values
listed above; `durationMs` describes planned active playback time, excluding
preparation, buffering, and pauses.

## Provider

`createAstronomyProvider().calculateTransits({ utc }, { signal? })` returns ten
geocentric planets and two true lunar nodes with UTC metadata. It requires no
coordinates and calculates no houses/axes. Natal calculations additionally
include AC/MC when defined. Cross aspects can connect those natal points to
transit bodies using ordinary source-qualified selections.

See the [calculation API](api.md#calculation-api) for signatures, errors, and
cancellation, and [calculation conventions](calculations.md) for the 1900–2100
range, tropical frame, and measured limits. Custom providers can return positions
calculated elsewhere.

## Demo controls

The demo owns time inputs and controls; these are not additional chart methods.

- **Time:** UTC date/time, Now, and hour/day/week/month/year stepping. Month/year
  steps clamp to the last valid day, including February 29. No civil-time or DST
  interpretation is performed.
- **Animation:** **Animate time changes** starts off. Previous/Next animates when
  enabled, with Pause/Resume and progress controls. Repeated steps start from the
  displayed time. Disabling animation finishes at the requested endpoint; date
  entry and Now apply immediately. Leaving transit mode cancels playback.
  Obsolete requests are cancelled and revision-checked; failures retain the
  previous valid chart. Continuous autoplay and timeline scrubbing are deferred.
- **Bodies:** **Celestial bodies** has separate natal/transit switches and All/None
  controls. Natal choices carry across modes; choices survive data, layout, and
  animation changes during the session. Calculation still includes all bodies.
- **Aspects:** independent family controls, Major/Minor sections, editable orbs,
  and Major only / All / None presets. Disabling retains the orb; original
  supplied inputs are kept for restoration. The legend combines enabled types
  from visible families.
- **Presentation and downloads:** layout and chart weight selectors are shared
  across chart modes. **Download SVG** uses an 800 × 800 full-chart layout;
  **Download PNG** rasterizes it at 2× for 1600 × 1600. **Download large SVG** uses
  a 1600 × 1600 layout and a `-large.svg` filename to reveal more crowded labels.
  Layer/body visibility still applies, and very dense charts may still compact.

## Exported types

| Entry point                                          | Types                                                                                                                                           | Purpose                                                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `@yuzuwoeser/astr3/model` (also `@yuzuwoeser/astr3`) | `ChartSide`, `AspectFamily`, `BodyReference`                                                                                                    | Source names (`natal`/`transit`), aspect families (also `cross`), and `{ chart, id }` body references. |
| `@yuzuwoeser/astr3/model` (also `@yuzuwoeser/astr3`) | `TransitChartInput`, `CrossAspectInput`, `CrossAspect`, `TransitBody`, `TransitChartModel`                                                      | Composite input and derived data.                                                                      |
| `@yuzuwoeser/astr3/model` (also `@yuzuwoeser/astr3`) | `TransitModelOptions`, `TransitOrbs`, `TransitAspectEnabledConfig`                                                                              | Independent orb/enablement maps by family.                                                             |
| `@yuzuwoeser/astr3/model` (also `@yuzuwoeser/astr3`) | `TransitSelection`, `TransitSelectionDetails`, `ScopedBody`, `ScopedAspect`, `ScopedGroup`                                                      | Source-qualified selections and results.                                                               |
| `@yuzuwoeser/astr3`                                  | `TransitChart`, `TransitChartOptions`, `TransitChartEvents`, `TransitLayers`, `TransitBodyVisibility`                                           | Mounted wheel, settings, event payloads, and visibility.                                               |
| `@yuzuwoeser/astr3`                                  | `TransitAnimation`, `TransitAnimationOptions`, `TransitAnimationState`, `TransitAnimationStatus`, `TransitAnimationEvents`, `TransitCalculator` | Optional animation controller and injected calculation contract.                                       |
