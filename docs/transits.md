# Transit bi-wheel API

`createTransitChart(container, options)` mounts a natal + transit wheel. Existing `createChart` natal integrations are unchanged. Import `createTransitModel`, `getTransitSelectionDetails`, and transit data types from `astr3/model` for headless use.

## Data and identity

`data` is `{ natal: ChartInput, transit: ChartInput, crossAspects?: CrossAspectInput[] }`. IDs must be unique within each source chart, as for natal charts; the same ID may appear in both charts. Transit houses/axes are ignored. The natal house system and orientation stay fixed as time changes. Transiting bodies expose a separate `natalHouse`, or `undefined` when natal cusps are unknown. Their derived `house` is not populated from transit-time cusps.

The frozen model exposes `natal`, `transit`, and `crossAspects`. Each side retains its intra-chart aspects and supplied groups. Transit-to-natal aspects are calculated across every natal/transit pair, including identically named bodies. Five major types, inclusive boundaries, and closest-exact-angle tie handling match the natal model.

Omitted aspect lists calculate contacts. A supplied list, including `[]`, is authoritative; orb edits do not filter it. Cross aspects use `{ id, type, bodyRefs: [{ chart: 'natal', id }, { chart: 'transit', id }], metadata? }`. Either endpoint order is accepted. References must resolve to one body from each side. Cross IDs are unique within their family. Exact angle, actual separation, and absolute orb are always derived from positions. Applying/separating and automatic pattern detection are not calculated.

## Options

- `orbs: { natal?, cross?, transit? }`: independent partial aspect-to-degree maps. Each starts with conjunction/opposition 8°, square/trine 6°, and sextile 4°. Limits accept finite values from 0° through 180°. Nested updates patch by family and aspect type.
- `layers`: the existing zodiac, houses, axes, bodies, aspects, groups, and degrees switches, plus `natalBodies`, `transitBodies`, `natalAspects`, `crossAspects`, and `transitAspects`. Both body sets and cross aspects start visible; natal and transit-to-transit aspects start hidden. Master `bodies`/`aspects` switches apply to both sides/all families. Visibility does not remove data or accessible list entries.
- `glyphs: { natal?: Record<string, string>, transit?: Record<string, string> }`: source-specific overrides using original body IDs.
- `transitColor`: transit glyph/anchor tint; defaults to the theme's group color. Natal anchors are filled circles, transit anchors outlined diamonds. Text descriptions and list headings identify their source independently of color.
- Existing `chartWeight`, `theme`, `lineStyles`, `selectionEffects`, `dimUnrelated`, and `ariaLabel` work across the wheel. Aspect line styles are keyed by aspect type and apply to every family.

## Methods and events

`update(data)` replaces both sides atomically. `updateTransit(data)` replaces only transit input and preserves the natal model object, current view, settings, and still-existing selections. Derived aspect IDs are stable by source-qualified endpoints and type; a selected aspect that disappears is cleared. Invalid data/options leave the previous chart intact.

`select({ chart, kind, id })` requires an explicit source: `natal` or `transit` for bodies/groups, `natal` for houses, and `natal`, `transit`, or `cross` for aspects. Invalid combinations/references throw. `transitSelectionKey` produces an unambiguous stable key. `selection` and `hover` events expose source-qualified objects, related bodies/aspects/groups, and relevant natal houses. House selection includes natal and transit occupants. Relationship expansion is immediate, not recursive.

`clearSelection`, `zoomBy`, `resetView`, `on`, `dispose`, `element`, and `error` follow the natal API. `update` events carry the composite transit model. Disposal removes only the chart's root and releases its DOM/GPU resources. Selection, navigation, visibility changes, and orb edits never invoke an ephemeris provider.

## Layout and accessibility

The natal wheel keeps its geometry; transit labels sit outside the zodiac without a separate transit circle. Their longitude markers and outward leader lines pin to the zodiac's outside edge. The degree scale has ticks on both sides, with degree numbers when space permits. Fitting both label bands makes the natal portion smaller on screen. Each band independently fits one or two local rows, hides degree/retrograde captions before reducing glyph sizes, and uses count badges when symbols cannot fit within 30° of their true positions. Badges open the body chooser without introducing new selection types. Shared zoom-aware text presets also scale zodiac glyphs, house/axis labels, and scale numbers; details disappear at smaller tiers. Cached measurements keep intermediate layout trials out of the live labels. Zoom in or use **Explore chart objects** for dense phone views.

Both sets project to the same house circle at their exact longitudes. All three aspect families and supplied group outlines join those shared-radius anchors. Filled natal dots and outlined transit diamonds distinguish sources; coincident anchors offer both objects in the chooser. The separate zodiac position dots sit directly on the inner zodiac edge for natal bodies and the outer edge for transits. Transit labels use a closer outer band to shorten their indicator lines while retaining the band's width for crowded layouts. Dots, glyphs, zodiac-edge longitude markers, and accessible buttons select the same source-qualified object. Mouse/touch picking tolerances and overlap choosers match natal charts. Houses/axes come solely from natal data. Unknown birth time does not fabricate houses.

All three families use the same [distance-aware conjunction bows](api.md#input-and-accessibility). Overlapping dots suppress the connector; distinguishable close dots get deeper inward bows, and farther-apart dots get shallower ones. The overlap threshold accounts for each endpoint's normal circle/diamond extent, including transit outline thickness. Hidden conjunctions remain inspectable through the object list/API and never add invisible curve targets.

## Provider and demo time controls

`createAstronomyProvider().calculateTransits({ utc }, { signal? })` returns the same ten geocentric planetary positions/speeds and two true lunar nodes as `calculate`, with UTC metadata, without calculating houses or requiring coordinates. Natal calculations also include Ascendant and Midheaven when defined. Cross aspects can connect transit planets/nodes to natal planets, nodes, AC, and MC; each point uses the same house-circle anchor geometry. Select them with their normal body IDs and explicit source, for example `{ chart: 'transit', kind: 'body', id: 'north-node' }`. Natal AC/MC axis captions also select their source-qualified points. Transit AC/MC are not calculated from UTC alone.

The adapter uses the same 1900–2100 range, tropical frame, numerical conventions, and cancellation limits described in [calculations](calculations.md). It does not label an exact transit instant as an uncertain birth time. Existing provider contracts remain usable; any application can supply positions calculated elsewhere.

The demo owns UTC date/time, Now, and hour/day/week/month stepping. Months clamp to the last valid day; no local timezone or DST interpretation is performed. Obsolete requests are cancelled and revision-checked; failures keep the previous valid chart. Orb settings are editable independently for each family in Configure and survive time/view changes. Authoritative supplied aspect lists retain their original contents. Continuous playback and timeline scrubbing are deferred.
