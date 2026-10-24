# API and data contracts

For natal + transit bi-wheels, see [Transit bi-wheel API](transits.md). The natal contracts below remain unchanged.

## Model

Import types and pure functions from `astr3/model`. `createModel(input, { orbs?, enabledAspects? })` validates, normalizes, and freezes its own objects/arrays. It does not mutate or freeze the caller's input. Application metadata is opaque and retained by reference; treat it as immutable.

| ChartInput field                | Meaning                                                                                                                                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bodies`                        | Required array of `{ id, name, longitude, latitude?, speed?, retrograde?, glyph?, metadata? }`. Angles are degrees; speed is longitude degrees/day. Negative speed implies retrograde unless overridden. |
| `houses`                        | Omit or use an empty array when unknown. Otherwise supply twelve `{ id, number, longitude }` cusps, numbered 1–12 and advancing once around the zodiac. Unequal cusps are preserved.                     |
| `angles`                        | Optional independent `ascendant` and `midheaven` longitudes. Opposite axes are drawn automatically. MC need not equal cusp 10.                                                                           |
| `aspects`                       | Omitted: calculate. Supplied array: authoritative, even when empty. Each entry is `{ id, type, bodyIds: [id, id], metadata? }`. Separation and absolute orb are derived from positions.                  |
| `groups`                        | Supplied configurations: `{ id, name, bodyIds: [], aspectIds: [], metadata? }`. Referenced aspect endpoints join the highlighted group.                                                                  |
| `houseStatus`                   | `available`, `unknown`, or `unavailable`; defaults from the presence of cusps. Available requires twelve houses.                                                                                         |
| `timeUncertain`                 | Labels a reference snapshot; the caller should omit uncertain houses/angles. The browser provider does so automatically.                                                                                 |
| `title`, `warnings`, `metadata` | Optional descriptive context and application data.                                                                                                                                                       |

IDs must be nonempty and unique across all object kinds. References must exist. Longitudes normalize into `[0, 360)`. Nonfinite positions, duplicate IDs, incomplete/out-of-order cusps, and dangling relationships throw `ChartDataError` (`code: INVALID_CHART_DATA`). Body/group names must be nonempty. Invalid updates leave the previous model intact.

`bodies` is the common collection for planets **and points**. The browser provider includes `ascendant`, `midheaven`, `north-node`, and `south-node` alongside the ten planets. They support the same selection, house occupancy, groups, aspects, glyph overrides, and house-circle anchors. Built-in glyphs are AC, MC, ☊, and ☋. Angles remain available separately in `angles` to draw the axes.

For precomputed input, supply point entries explicitly in `bodies`; `createModel` preserves the supplied collection and does not invent points from `angles`. To make an AC/MC axis caption selectable, use the canonical body ID and the same longitude in `angles` and `bodies`. For example:

```ts
const data = {
  bodies: [
    { id: 'sun', name: 'Sun', longitude: 133 },
    { id: 'ascendant', name: 'Ascendant', longitude: 13 },
    { id: 'midheaven', name: 'Midheaven', longitude: 278 },
    { id: 'north-node', name: 'North Node', longitude: 35.6 },
    { id: 'south-node', name: 'South Node', longitude: 215.6 },
  ],
  angles: { ascendant: 13, midheaven: 278 },
};
chart.update(data);
chart.select({ kind: 'body', id: 'ascendant' });
```

Supplied nodes can use any convention; include it in metadata for application details. The example provider uses true nodes; see [calculation conventions](calculations.md). Automatic aspects include every supplied point pair, including the nodes' mutual opposition. Supply an explicit aspect list to apply different point-specific rules.

| Aspect type    | Exact angle | Default maximum orb | Enabled by default |
| -------------- | ----------: | ------------------: | ------------------ |
| conjunction    |          0° |                  8° | Yes                |
| sextile        |         60° |                  4° | Yes                |
| square         |         90° |                  6° | Yes                |
| trine          |        120° |                  6° | Yes                |
| opposition     |        180° |                  8° | Yes                |
| semisextile    |         30° |                  2° | No                 |
| semisquare     |         45° |                  2° | No                 |
| quintile       |         72° |                  2° | No                 |
| sesquiquadrate |        135° |                  2° | No                 |
| biquintile     |        144° |                  2° | No                 |
| quincunx       |        150° |                  3° | No                 |

Override limits with `orbs: { trine: 5 }`. Boundaries are inclusive. Overlapping calculated limits choose the closest exact **enabled** angle; exact ties keep definition order, with the original major types first. Supplied aspects are not filtered by orb limits. Calculated IDs survive body reordering. Aspects use longitude, not three-dimensional separation or declination parallels.

`enabledAspects` is an `AspectEnabledConfig`: a partial aspect-to-boolean map. For example, `{ square: false, quincunx: true }` disables squares and enables quincunxes. Changing an orb does not enable its type. Disabled aspects are excluded from the model, connectors, picking, accessible list, selection events, and relationship details, including when supplied explicitly. Supplied data is validated before filtering. Groups referencing excluded aspects are temporarily omitted; body-only groups remain available. Keep the original input to restore excluded aspects/groups with a later settings change. Invalid references still throw.

`ASPECT_DEFINITIONS` exposes each type's display name, exact angle, default `orb`, and `major` flag. `ASPECT_ANGLES`, `DEFAULT_ORBS`, and `DEFAULT_ENABLED_ASPECTS` expose frozen maps. `calculateAspects(bodies, orbs?, enabledAspects?)` uses the same defaults and filtering as `createModel`; its existing two-argument form remains valid. `angularDistance`, `signedDistance`, `normalize`, `zodiacPosition`, and `formatPosition` support shared application logic.

```ts
chart.setOptions({ enabledAspects: { semisextile: true, quincunx: true } });
chart.setOptions({ enabledAspects: { square: false }, orbs: { quincunx: 2 } });
// Earlier enablement and orb choices remain in effect.
```

## Renderer

`createChart(container, { data, ...options })` returns:

| Member                                   | Behavior                                                                                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `model`, `selection`, `element`, `error` | Current normalized model, selected reference, mounted root, and graphics error.                                                                |
| `update(data)`                           | Replace data; preserve a still-existing selected ID, or clear it with source `update`.                                                         |
| `setOptions(options)`                    | Patch display, orb, and enablement options. Recalculate omitted aspects; filter supplied aspects by enablement. Clear removed selections.      |
| `select(reference)`                      | Select `{ kind: 'body' \| 'house' \| 'aspect' \| 'group', id }`. Unknown references throw `RangeError`.                                        |
| `clearSelection()`                       | Deselect.                                                                                                                                      |
| `zoomBy(factor)`, `resetView()`          | Multiply zoom (clamped to 0.6–5) or restore zoom/pan. Invalid factors throw.                                                                   |
| `on(event, listener)`                    | Subscribe; returns an unsubscribe function.                                                                                                    |
| `dispose()`                              | Remove owned DOM, observers/listeners, queued frames, geometry/materials, renderer, and WebGL context. Safe twice; subsequent mutations throw. |

Options:

- `layout`: `'default'` (library and demo default) or `'alternative'`, typed as `ChartLayout`. Both constructors and `setOptions` accept it. Invalid values throw `RangeError` before changing live state. See [Layout presets](#layout-presets).
- `chartWeight`: `light` (library default), `regular`, or `bold`. Changes chart strokes, label weight, and symbol strokes. Crowded labels may choose a smaller font to fit the measured weight. The demo starts at Regular and provides a Chart weight selector. Invalid values throw `RangeError`; invalid option updates leave the previous settings intact.
- `theme`: patch background, foreground, muted, ring, accent, group, the four element colors, and per-type aspect colors. Exported `DARK_THEME` and `LIGHT_THEME` provide complete palettes.
- `glyphs`: body-ID-to-text overrides, falling back to the body's glyph, built-in symbol, or two name characters. Strings are text, never injected HTML. Use short glyphs.
- `layers`: patch `zodiac`, `bodies`, `houses`, `axes`, `aspects`, `groups`, `degrees`; all default true. Hidden layers remain available in the model and accessible list.
- `bodyVisibility`: a `BodyVisibility` record mapping original body IDs to booleans, for example `{ moon: false, 'north-node': false }`. Omitted IDs are visible. Constructor options are copied; `setOptions` merges patches by ID, and `true` restores a hidden body. Unknown IDs retain their setting for future data updates. Invalid records/values throw before changing the chart. Hiding a body removes its glyph, markers, leaders, and wheel pick targets, plus aspects and group outlines involving it. Model data, relationships, house occupancy, selection, and accessible entries remain available; hidden body entries say “hidden on wheel.” AC/MC axis guides remain controlled by `layers.axes`, but their captions no longer select a hidden point. Visibility changes never request new ephemeris calculations.
- `enabledAspects`: patch aspect-to-boolean settings as described above. This excludes aspect data; the `layers.aspects` switch only hides graphics.
- `lineStyles`: per aspect type `{ width?, dash?: [onPixels, offPixels] }`, in CSS pixels. Width is the baseline before the chart-weight multiplier; dash lengths stay constant. Major types default to solid lines, minor types to `[4, 3]` dashes. Use `[1, 0]` to make a minor aspect solid.
- `selectionEffects`: `{ color?, dimOpacity?, lineWidth? }`, defaulting to theme accent, `0.22`, and `2.5` pixels. Use opacity in `[0, 1]` and positive widths.
- `dimUnrelated: false`: keep unrelated objects at normal opacity.
- `ariaLabel`: accessible chart name; defaults to title.

Nested option records patch by key. A per-aspect line-style object replaces that aspect's previous style. Primary selection takes precedence over transient hover highlighting. Theme overrides remain partial; applications implementing a complete `ChartTheme` must include colors for all eleven aspect types.

| Chart weight | Stroke multiplier | Text weight | Extra symbol stroke |
| ------------ | ----------------: | ----------: | ------------------: |
| Light        |                1× |         400 |                 0px |
| Regular      |              1.5× |         500 |              0.15px |
| Bold         |                2× |         650 |               0.3px |

The multiplier also applies to `selectionEffects.lineWidth`, rings, cusps, ticks, leader lines, and markers. Symbols include built-in zodiac/planet glyphs and supplied custom glyph strings. Collision measurements include the selected font weight and symbol stroke. Planet labels avoid the measured house-number and degree-number bounds.

```ts
import type { ChartWeight } from 'astr3';

const chartWeight: ChartWeight = 'bold';
chart.setOptions({ chartWeight });
chart.setOptions({ chartWeight: 'regular', glyphs: { sun: '☉' } });
```

## SVG and PNG export

Both mounted chart types expose `exportSvg(options?): Promise<string>` and
`exportPng(options?): Promise<Blob>`. Exports are generated entirely in the browser;
SVG contains vector shapes and outlined text, and PNG rasterizes that same SVG.
Export does not capture the WebGL canvas and also works when WebGL is unavailable.

```ts
import type { ChartExportOptions, ChartPngExportOptions } from 'astr3';

const svgOptions: ChartExportOptions = { size: 1024, view: 'full' };
const svg = await chart.exportSvg(svgOptions);
const pngOptions: ChartPngExportOptions = { size: 1024, pixelRatio: 2 };
const png = await chart.exportPng(pngOptions); // image/png, 2048 × 2048
```

| Option        | Default  | Behavior                                                                                                                                                                                                  |
| ------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `view`        | `'full'` | Fit the complete wheel and omit selection effects. `'current'` preserves the current camera and selection, uses the viewport aspect ratio, and scales the result to `size` wide. Hover is always ignored. |
| `size`        | `1024`   | Output width in pixels. Full exports are square; packing and text tiers use this size. Current-view exports lay out at the mounted viewport dimensions before scaling.                                    |
| `transparent` | `false`  | Omit the overall background. Body labels and cluster badges retain theme-colored backgrounds for legibility.                                                                                              |
| `pixelRatio`  | `2`      | PNG only: multiply SVG output dimensions when rasterizing.                                                                                                                                                |

Current theme, chart weight, layout, layers, body visibility, glyph overrides,
line styles and aspect settings are retained. Export includes count badges and
chart-status notices, but excludes controls, object lists, tooltips, overlap
choosers and WebGL error messages. A count badge in a file is static; use a larger
full-chart `size` to reveal more individual labels. No hidden data is appended.

Export captures chart state when called, before loading export code. Data/options
updates and animation can continue without changing an in-progress export. Export
emits no chart events and does not change the model, view, focus or selection.
A call started before disposal may finish; calls made after disposal reject.

The lazily loaded export fonts derive from Noto Sans, Noto Sans Symbols and Noto
Sans Symbols 2. Paths require no installed fonts or external resources, and text
is not editable as SVG text. The interactive chart continues to use its existing
HTML/system-font typography. Export measures the bundled outlines before packing,
so glyph appearance and label placement can differ slightly from the live view.
Light/Regular/Bold use synthetic outline strokes.

Supported visible text includes built-in zodiac/body glyphs (including Chiron,
lunar nodes and AC/MC), printable ASCII, Latin-1 U+00A0–U+00FF, retrograde ℞,
primes ′/″, en/em dashes and ellipsis. Text-presentation selector U+FE0E is ignored.
Unsupported visible text rejects the export with the label, missing characters
and Unicode code points; it is never silently replaced. Arbitrary titles remain
escaped accessible XML text and do not require outline coverage. Caller metadata
and internal transit IDs are not serialized.

`size` and `pixelRatio` must be positive finite numbers. Rounded output dimensions
must be at least 1 pixel, at most 8,192 pixels per side and at most 32 million
pixels overall; both SVG and raster dimensions are checked before allocation.
Invalid options reject without changing the chart. PNG decoding, canvas, or
encoding failures also reject. Export supports literal hex/named/rgb()/hsl()
colors; unresolved CSS variables, context-dependent colors and paint URLs reject.

Methods return content without downloading it. Applications own filenames and
saving; the demo provides **Download SVG** and **Download PNG** actions with full
chart defaults. For example, create a Blob from the SVG string with MIME type
`image/svg+xml`, create an object URL, and revoke that URL after download.

## Events and details

| Event       | Payload                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `selection` | `{ selection, details, source }`, source is `pointer`, `keyboard`, `programmatic`, or `update`. Selection/details can be null. |
| `hover`     | `{ selection, details, x, y }`, client coordinates for application HTML tooltips. Null on leaving the wheel.                   |
| `update`    | `{ model }` after data/options change.                                                                                         |
| `view`      | `{ zoom, pan: { x, y } }`; pan is in world units.                                                                              |
| `error`     | `{ code, message, cause? }`; code is `WEBGL_UNAVAILABLE` or `CONTEXT_LOST`. Check `chart.error` for current state.             |
| `dispose`   | `undefined`, emitted once when disposal starts, so companion controllers can release their resources.                          |

`SelectionDetails` includes the selected object/reference and related bodies, houses, aspects, and groups. Bodies include sign, degree within sign, and optional house. Aspects include exact angle, actual separation, and absolute orb; applying/separating is not calculated. Groups include supplied bodies plus aspect endpoints. Houses return occupants; bodies return immediate aspects and endpoints without recursive graph expansion.

Selection events include programmatic changes and selected-data refreshes. Render panels idempotently; avoid unconditionally calling `select` from a selection listener.

## Layout presets

`layout: 'default'` retains the original natal and transit arrangement. `layout: 'alternative'` puts the actual house band outermost and zodiac signs immediately inside it. The natal ruler and symbols follow inside the zodiac; in a bi-wheel, the transit ruler/symbols come first, then the natal ruler/symbols. Both sources project onto one separate central aspect circle. The outer source ruler shares the zodiac's inner boundary, and both rulers use the same zodiac degrees rather than house-relative degrees.

Alternative house dividers, highlights and picking stay within the outer annulus. Unknown or hidden houses leave that space reserved without invented annotations. House numbers that cannot fit their actual sector are omitted; the band and accessible house entries remain selectable. The two source symbol bands have equal widths; a natal-only chart uses an expanded single band. All symbols keep the same bounded packing, caption and overflow behavior. Compact alternative labels use slightly less padding.

Alternative ruler dots stay on their source boundary and short leaders connect displaced symbols. A faint dashed radial guide connects an active body to its inner anchor; active aspects/groups guide their members. Guides add no picking targets. Natal/transit colors and inner circle/diamond markers retain their existing meaning. The inner aspect circle remains independent of house visibility.

```ts
import type { ChartLayout } from 'astr3';

const layout: ChartLayout = 'alternative';
chart.setOptions({ layout });
chart.setOptions({ layout: 'default' });
```

Changing layout preserves data, stable selection IDs, zoom/pan, themes and aspect settings. Normal option-update events still apply; no ephemeris calculation is requested. Each preset fits its own outer bounds, including axis captions. Switching back restores default placement for the same data/view. The demo's **Default / Alternative** selector is shared across chart modes and retained through calculation/time changes. Layout is not part of `ChartInput` or the headless model; arbitrary ring reordering and radius controls are not exposed.

## Input and accessibility

Click/tap to select; click empty space or press Escape to clear. Drag to pan; scroll/pinch or use buttons to zoom. Ctrl/Cmd wheel is left to the browser. Default orientation puts the ascendant at left, or Aries at left when unknown. Zodiac longitude advances counterclockwise.

In the default layout, the house circle uses the original inner placement, with house numbers just inside it. House cusps share the zodiac degree scale; select a house to inspect its exact cusp position. The zodiac has degree ticks on both inside and outside edges, with numbers when space permits. There is no duplicated house-degree scale.

Every planet or supplied point has a filled inner anchor dot at its exact longitude, including bodies without aspects. Aspect lines and supplied group outlines meet those anchors. In the default layout, zodiac position dots sit directly on the zodiac's inner boundary for natal bodies and its outer boundary for transits. Moving a label never moves either marker.

Conjunctions use deterministic inward bows whose depth decreases as the dots separate. In CSS pixels, let `d` be the distance between dot centers, `rA` and `rB` their normal visual radii, and `R` the aspect-anchor circle radius. No connector is drawn when `d ≤ d0 = rA + rB + 2`. Beyond that threshold, midpoint depth is `min(20, R / 4) × d0 / d`. A symmetric quadratic Bézier joins the exact anchors, with its control point twice that depth inward from the chord midpoint; 17 points sample the curve. An antipodal pair falls back to a straight connector.

Curves fade in with smoothstep opacity over the first 4 CSS pixels beyond the overlap threshold and become pickable at 50% geometric opacity. Hidden curves have no hit targets. Their conjunctions remain available in the model, accessible list, and selection API; selecting one highlights the endpoints without restoring a curve. Normal marker radii include transit outlines and chart weight, but ignore selection enlargement, so hovering or selecting does not change the geometry. Zoom/resizing follow visual spacing; panning, endpoint order, and orb edits for an unchanged pair do not reshape a bow. Other aspect types use straight connectors. There are no new configuration options.

Anchor dots select the same body and expose the same hover/selection details as its symbol. They share relationship highlighting, dimming, theme colors, and chart weight, with a 6 CSS pixel picking radius for mouse and 12 for touch. Overlapping dots open the object chooser. The `bodies` layer controls the dots alongside symbols and outer markers; dots remain at the same radius when houses are hidden or unknown and when aspects are hidden.

In the default layout, the complete planet label stays between the house circle and outer degree ticks; alternative labels stay within their own source band. Both keep 4 CSS pixels of clearance. A deterministic circular constraint solver fits labels together in one or two radial rows without adding circles. It preserves zodiac order within each row, balances angular displacement, and never moves a label more than 30° from its true longitude. Indicator lines terminate at label edges; exact longitude markers and inner aspect anchors never move. These rules also apply when houses are unknown or hidden.

Wheel text uses four size tiers based on effective scale (CSS pixels per wheel unit, including viewport size and camera zoom):

| Effective scale |                                  Body/zodiac glyphs | House numbers / axis captions | Scale numbers | Body degree/retrograde captions |
| --------------- | --------------------------------------------------: | ----------------------------: | ------------: | ------------------------------: |
| Below 0.65      | 14px × scale / 0.65, rounded to 0.5px; 10px minimum |                           8px |        Hidden |                          Hidden |
| 0.65–0.89       |                                                18px |                           9px |        Hidden |                          Hidden |
| 0.90–1.59       |                                                24px |                          10px |           9px |         10px when space permits |
| 1.60+           |                                                32px |                          13px |          12px |         13px when space permits |

AC/MC body glyphs retain their 0.72 optical scaling. Controls, detail panels, object-list text, marker sizes, and picking tolerances keep their normal screen sizes. Chart weight can affect available space through measured glyph dimensions.

Each natal/transit band first checks whether its full captions fit at the selected glyph size. If they do not, it omits the captions before trying smaller glyph presets (24, 18, then 14px as applicable). This retains readable symbols instead of shrinking them to accommodate secondary text. Below the smallest tier, glyphs shrink proportionally with zoom to the 10px floor. Hidden positions and retrograde status remain available through selection/hover details and **Explore chart objects**.

When symbols still cannot fit locally, count badges represent crowded neighborhoods. Each badge stays within 30° of all its members. Click/tap or press Enter/Space to open a chooser and select an original body; Escape closes the chooser and returns focus to the badge. A badge highlights when it contains an active body. Badges introduce no model object or selection type. Zooming/resizing expands them into individual symbols when space permits. If even a badge cannot fit, exact dots and accessible entries remain available.

Text dimensions are cached by typography and content; cache misses are measured in an invisible probe outside the live labels. Font loading and typography changes invalidate measurements. Layout trials never toggle visible captions, and layout results are reused for panning and appearance-only selection/hover changes. Identical chart/scale inputs produce identical placement regardless of input order or zoom history.

Screen-space priority: body labels/markers → aspects → group interiors → houses. Aspect tolerance is 8 CSS pixels with mouse and 14 with touch. Ties at the highest matching priority produce a chooser. Three or more noncollinear group members define a convex interior; degenerate groups remain selectable in the list/API.

Expand **Explore chart objects** for native buttons carrying position/orb text and `aria-pressed`. Tab moves normally; arrows/Home/End move within the list; Enter/Space selects. A live region announces selection. With wheel focus, `+`, `-`, and `0` zoom/reset. Camera movement is immediate, and label transitions respect reduced motion.

The list survives graphics loss. Initial WebGL failure emits asynchronously for immediate subscribers. Recovery clears `chart.error` and redraws; browsers cannot guarantee every context can recover.
