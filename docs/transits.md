# Transit bi-wheel API

`createTransitChart(container, options)` mounts a natal + transit wheel. Existing `createChart` natal integrations are unchanged. Import `createTransitModel`, `getTransitSelectionDetails`, and transit data types from `astr3/model` for headless use.

## Data and identity

`data` is `{ natal: ChartInput, transit: ChartInput, crossAspects?: CrossAspectInput[] }`. IDs must be unique within each source chart, as for natal charts; the same ID may appear in both charts. Transit houses/axes are ignored. The natal house system and orientation stay fixed as time changes. Transiting bodies expose a separate `natalHouse`, or `undefined` when natal cusps are unknown. Their derived `house` is not populated from transit-time cusps.

The frozen model exposes `natal`, `transit`, and `crossAspects`. Each side retains its enabled intra-chart aspects and supplied groups. Transit-to-natal aspects are calculated across every natal/transit pair, including identically named bodies. All eleven [aspect types and defaults](api.md#model), inclusive boundaries, and closest-enabled-angle tie handling match the natal model. The five major types start enabled in each family; the six minor types start disabled.

Omitted aspect lists calculate contacts. A supplied list, including `[]`, is authoritative; orb edits do not filter it, but disabled types are excluded after validation. Dependent supplied groups are temporarily omitted as in the natal model. Cross aspects use `{ id, type, bodyRefs: [{ chart: 'natal', id }, { chart: 'transit', id }], metadata? }`. Either endpoint order is accepted. References must resolve to one body from each side. Cross IDs are unique within their family. Exact angle, actual separation, and absolute orb are always derived from positions. Applying/separating and automatic pattern detection are not calculated.

## Options

- `layout`: `'default'` or `'alternative'` (default: `'default'`). The alternative places natal houses outermost, zodiac second, transit symbols inside its inner ruler, then a second natal ruler and natal symbols. Both project to a separate shared inner aspect circle. Runtime switching preserves selections and view. See [layout presets](api.md#layout-presets).
- `orbs: { natal?, cross?, transit? }`: independent partial aspect-to-degree maps. Each starts with conjunction/opposition 8°, square/trine 6°, and sextile 4°. Limits accept finite values from 0° through 180°. Nested updates patch by family and aspect type.
- `enabledAspects: { natal?, cross?, transit? }`: independent partial aspect-to-boolean maps (`TransitAspectEnabledConfig`). For example, `wheel.setOptions({ enabledAspects: { cross: { quincunx: true, square: false } } })` changes only those cross-family flags. Disabled aspects leave the model, wheel, explorer, and relationship details; removed selections clear. Orb changes do not toggle enablement. The headless `createTransitModel(data, options)` accepts the same family settings through `TransitModelOptions`.
- `layers`: the existing zodiac, houses, axes, bodies, aspects, groups, and degrees switches, plus `natalBodies`, `transitBodies`, `natalAspects`, `crossAspects`, and `transitAspects`. Both body sets and cross aspects start visible; natal and transit-to-transit aspects start hidden. Master `bodies`/`aspects` switches apply to both sides/all families. Visibility does not remove data or accessible list entries.
- `glyphs: { natal?: Record<string, string>, transit?: Record<string, string> }`: source-specific overrides using original body IDs.
- `transitColor`: transit glyph/anchor tint; defaults to the theme's group color. Natal anchors are filled circles, transit anchors outlined diamonds. Text descriptions and list headings identify their source independently of color.
- Existing `chartWeight`, `theme`, `lineStyles`, `selectionEffects`, `dimUnrelated`, and `ariaLabel` work across the wheel. Aspect line styles are keyed by aspect type and apply to every family.

## Methods and events

`update(data)` replaces both sides atomically. `updateTransit(data)` replaces only transit input and preserves the natal model object, current view, settings, and still-existing selections. Derived aspect IDs are stable by source-qualified endpoints and type; a selected aspect that disappears is cleared. Invalid data/options leave the previous chart intact.

`select({ chart, kind, id })` requires an explicit source: `natal` or `transit` for bodies/groups, `natal` for houses, and `natal`, `transit`, or `cross` for aspects. Invalid combinations/references throw. `transitSelectionKey` produces an unambiguous stable key. `selection` and `hover` events expose source-qualified objects, related bodies/aspects/groups, and relevant natal houses. House selection includes natal and transit occupants. Relationship expansion is immediate, not recursive.

`clearSelection`, `zoomBy`, `resetView`, `on`, `dispose`, `element`, and `error` follow the natal API. `update` events carry the composite transit model. Disposal removes only the chart's root and releases its DOM/GPU resources. Selection, navigation, visibility changes, enablement, and orb edits never invoke an ephemeris provider.

## Layout and accessibility

In the default layout, the natal wheel keeps its geometry; transit labels sit outside the zodiac without a separate transit circle. Their longitude markers and outward leader lines pin to the zodiac's outside edge. The degree scale has ticks on both sides, with degree numbers when space permits. Fitting both label bands makes the natal portion smaller on screen. Each band independently fits one or two local rows, hides degree/retrograde captions before reducing glyph sizes, and uses count badges when symbols cannot fit within 30° of their true positions. Badges open the body chooser without introducing new selection types. Shared zoom-aware text presets also scale zodiac glyphs, house/axis labels, and scale numbers; details disappear at smaller tiers. Cached measurements keep intermediate layout trials out of the live labels. Zoom in or use **Explore chart objects** for dense phone views.

In the default layout, both sets project to the same house circle at their exact longitudes; the alternative uses a separate shared inner aspect circle. All three aspect families and supplied group outlines join those shared-radius anchors. Filled natal dots and outlined transit diamonds distinguish sources; coincident anchors offer both objects in the chooser. In the default layout, the separate zodiac position dots sit directly on the inner zodiac edge for natal bodies and the outer edge for transits. Default transit symbols prefer a closer band beside the zodiac rim, omitting secondary captions before using more outward space. Crowded default charts can still use the wider band before reducing symbol sizes. In the alternative, each source's position dots sit on its own inner-facing ruler. Dots, glyphs, longitude markers, and accessible buttons select the same source-qualified object. Mouse/touch picking tolerances and overlap choosers match natal charts. Houses/axes come solely from natal data. Unknown birth time does not fabricate houses.

All three families use the same [distance-aware conjunction bows](api.md#input-and-accessibility). Overlapping dots suppress the connector; distinguishable close dots get deeper inward bows, and farther-apart dots get shallower ones. The overlap threshold accounts for each endpoint's normal circle/diamond extent, including transit outline thickness. Hidden conjunctions remain inspectable through the object list/API and never add invisible curve targets.

## Provider and demo time controls

### Animated time steps

`createTransitAnimation(chart, calculateTransits, options?)` is an opt-in browser controller exported from `astr3`. Inject a calculator with the same signature as the optional adapter's `calculateTransits`; the controller does not import Astronomy Engine. Existing `updateTransit` calls remain immediate.

```ts
import { createTransitAnimation } from 'astr3';
import { createAstronomyProvider } from 'astr3/ephemeris';

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
- `on('state', listener)` reports status, interval, and planned-duration changes. `on('progress', listener)` receives `{ state, data }` after a calculated snapshot is committed; `data` is the calculator's `ChartInput`. `on('error', listener)` receives `{ message, cause }`. Subscriptions return unsubscribe functions. Failures stop playback and leave the last valid chart intact.
- The controller honors `prefers-reduced-motion: reduce` by applying only the endpoint. A preference change during playback finishes at that endpoint. Hidden pages suspend time; user pauses remain paused when the page returns. Settings and camera changes remain available during playback. Applications must cancel before replacing chart data themselves.

Every displayed timestamp is calculated directly: longitude, speed, retrograde flags, aspects, picking, and accessible details describe the same instant. Labels still use bounded collision packing, independently of exact longitude markers. No endpoint interpolation or per-frame longitude displacement is used to create motion.

Preflight checks midpoint positions against each segment's angular chord, targeting at most **0.05°** deviation. It refines the uniform time spacing around curved paths and reversals, then fixes the speed before playback. Intervals up to seven days protect every body's trajectory and use gaps of at most six simulated hours. Longer intervals allow coarser inner-body motion but protect Jupiter through Pluto, with gaps of at most one simulated day. Stations trigger further refinement. These are animation-resolution targets, tested against dense provider trajectories, not an additional ephemeris accuracy guarantee or an exact station-finding API. The preflight checks cannot prove a bound for arbitrary custom trajectories.

`options.outerBodyIds` can identify the bodies to protect in longer intervals when a provider uses different IDs; defaults are `jupiter`, `saturn`, `uranus`, `neptune`, and `pluto`. Body IDs must remain stable throughout a run. Custom calculators should honor the supplied abort signal; revision checks also discard obsolete results from calculators that ignore it.

Preferred active durations are 0.6 seconds for up to one hour, 1 second for up to one day, 2 seconds for up to seven days, 4 seconds for up to 31 days, and 15 seconds for longer steps. Sampling limits may lengthen these before playback, targeting at most 30 displayed samples per second. Preflight uses constant sample storage; playback keeps four lookahead samples. Slow calculations or rendering extend elapsed time rather than skipping trajectory samples. Preparation, buffering, and pauses are excluded from `durationMs`. More than 8,192 required frames fails with a request to choose a shorter interval.

### Calculation and demo controls

`createAstronomyProvider().calculateTransits({ utc }, { signal? })` returns the same ten geocentric planetary positions/speeds and two true lunar nodes as `calculate`, with UTC metadata, without calculating houses or requiring coordinates. Natal calculations also include Ascendant and Midheaven when defined. Cross aspects can connect transit planets/nodes to natal planets, nodes, AC, and MC; each point uses the same house-circle anchor geometry. Select them with their normal body IDs and explicit source, for example `{ chart: 'transit', kind: 'body', id: 'north-node' }`. Natal AC/MC axis captions also select their source-qualified points. Transit AC/MC are not calculated from UTC alone.

The adapter uses the same 1900–2100 range, tropical frame, numerical conventions, and cancellation limits described in [calculations](calculations.md). It does not label an exact transit instant as an uncertain birth time. Existing provider contracts remain usable; any application can supply positions calculated elsewhere.

The demo owns UTC date/time, Now, and hour/day/week/month/year stepping. Month and year steps clamp to the last valid day, including February 29; no local timezone or DST interpretation is performed. **Animate time changes** starts off. When enabled, Previous/Next animates the chosen interval with Pause/Resume and progress controls. Repeated steps start from the displayed time. Disabling animation finishes at the requested endpoint; date entry and Now apply immediately. Leaving transit mode cancels playback. Obsolete requests are cancelled and revision-checked; failures keep the previous valid chart. **Aspects** controls provide Major/Minor sections, individual switches, editable orbs, and Major only / All / None presets for the selected family. Disabling a type retains its orb value; settings survive time/view changes during the session. The legend shows the union of enabled types in currently visible families. Original supplied inputs are retained so re-enabling restores their aspects/groups. Continuous autoplay and timeline scrubbing are deferred.
