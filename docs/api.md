# API and data contracts

Reference for public imports, chart data, renderer options, events, and exports.
Start with the [README example](../README.md#use-the-library) or the
[integration walkthrough](agent-integration.md) for a complete setup. Transit
models, source-qualified selections, and animation are covered in the
[transit reference](transits.md).

## Entry points

| Import                                         | Exports and runtime                                                                                                                                                                                                              |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@yuzuwoeser/astr3/model`                      | [Models and relationships](#model), [math and identity helpers](#model-helpers), constants, and data types. No DOM, Three.js, or ephemeris dependency.                                                                           |
| `@yuzuwoeser/astr3`                            | Everything from `@yuzuwoeser/astr3/model`, plus chart/animation factories, template resolvers, `ChartTemplateError`, `DARK_THEME`, `LIGHT_THEME`, and renderer/template/animation types. Import is SSR-safe; mount in a browser. |
| `@yuzuwoeser/astr3/ephemeris`                  | [Calculation API](#calculation-api): `createAstronomyProvider`, `calculateHouses`, `CalculationError`, and provider/house types. Requires the optional `astronomy-engine` peer; no DOM or Three.js.                              |
| `@yuzuwoeser/astr3/chart-template.schema.json` | Strict JSON Schema (draft 2020-12) for both [template variants](#json-templates). A packaged JSON asset.                                                                                                                         |

These three JavaScript entry points and the JSON Schema asset are public. Use
them instead of importing internal files. [Exported types](#exported-types)
are indexed at the end of this page.

## Model

Import types and pure functions from `@yuzuwoeser/astr3/model`. `createModel(input, { orbs?, enabledAspects? })` validates, normalizes, and freezes its own objects/arrays. It does not mutate or freeze the caller's input. Application metadata is opaque and retained by reference; treat it as immutable.

| ChartInput field                | Meaning                                                                                                                                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bodies`                        | Required array of `{ id, name, longitude, latitude?, speed?, retrograde?, glyph?, metadata? }`. Angles are degrees; speed is longitude degrees/day. Negative speed implies retrograde unless overridden. |
| `houses`                        | Omit or use an empty array when unknown. Otherwise supply twelve `{ id, number, longitude, metadata? }` cusps, numbered 1–12 and advancing once around the zodiac. Unequal cusps are preserved.          |
| `angles`                        | Optional independent `ascendant` and `midheaven` longitudes. Opposite axes are drawn automatically. MC need not equal cusp 10.                                                                           |
| `aspects`                       | Omitted: calculate. Supplied array: authoritative, even when empty. Each entry is `{ id, type, bodyIds: [id, id], metadata? }`. Separation and absolute orb are derived from positions.                  |
| `groups`                        | Supplied configurations: `{ id, name, bodyIds: [], aspectIds: [], metadata? }`. Referenced aspect endpoints join the highlighted group.                                                                  |
| `houseStatus`                   | `available`, `unknown`, or `unavailable`; defaults from the presence of cusps. Available requires twelve houses.                                                                                         |
| `timeUncertain`                 | Labels a reference snapshot; the caller should omit uncertain houses/angles. The browser provider does so automatically.                                                                                 |
| `title`, `warnings`, `metadata` | Optional title string, array of warning strings, and opaque `Readonly<Record<string, unknown>>` metadata. Object-level metadata uses the same shape.                                                     |

IDs must be nonempty and unique across all object kinds. References must exist.
Longitudes normalize into `[0, 360)`; latitude must be finite and within ±90°.
Houses are sorted by number, then checked for one complete turn around the zodiac.
Nonfinite positions/speeds, duplicate IDs, invalid cusps, and dangling relationships
throw `ChartDataError` (`code: 'INVALID_CHART_DATA'`). Body/group names must be
nonempty. An aspect needs two distinct body IDs. A group needs at least one body
or aspect reference. Invalid updates leave the previous model intact.

### Normalized results

`createModel(input, options?): ChartModel` returns these fields:

| Field/type                              | Result                                                                                                                                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`                                 | Supplied title, or `'Natal chart'`.                                                                                                                                  |
| `bodies: readonly Body[]`               | Copied input fields, normalized longitude, derived zodiac position, boolean `retrograde`, and optional `house` number (1–12). Without cusps, `house` is `undefined`. |
| `houses: readonly House[]`              | Cusps in house-number order, with normalized longitude and occupant `bodyIds`; `[]` when omitted.                                                                    |
| `aspects: readonly Aspect[]`            | Input fields plus `angle` (exact angle), `separation` (shortest longitude distance), and absolute `orb`, all in degrees. Applying/separating is not calculated.      |
| `groups: readonly GroupInput[]`         | Supplied groups with duplicate member references removed. No automatic pattern detection.                                                                            |
| `angles: ChartAngles`                   | Normalized supplied axes, or `{}`.                                                                                                                                   |
| `houseStatus: HouseStatus`              | Supplied status, or `'available'` with cusps and `'unknown'` without them.                                                                                           |
| `timeUncertain`, `warnings`, `metadata` | Default to `false`, `[]`, and `undefined`. Metadata on charts and objects remains by reference.                                                                      |

`ZodiacPosition` is `{ sign, signIndex, degree }`: English sign name, zero-based
Aries-to-Pisces index, and degrees within the sign in `[0, 30)`. Bodies retain
their exact longitude independently of where the renderer places their labels.

### Planets and points

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

Supplied nodes can use any convention; include it in metadata for application details. The bundled provider uses true nodes; see [calculation conventions](calculations.md). Automatic aspects include every supplied point pair, including the nodes' mutual opposition. Supply an explicit aspect list to apply different point-specific rules.

### Aspects and enablement

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

Override limits with `orbs: { trine: 5 }`. Values must be finite and within
`[0, 180]`; unknown type keys and nonboolean enablement values throw
`ChartDataError`. Boundaries are inclusive. Overlapping calculated limits choose
the closest exact **enabled** angle; exact ties keep definition order, with the
major types first. Supplied aspects are not filtered by orb limits. Calculated
IDs survive body reordering. Aspects use longitude, not three-dimensional
separation or declination parallels.

`enabledAspects` is an `AspectEnabledConfig`: a partial aspect-to-boolean map. For example, `{ square: false, quincunx: true }` disables squares and enables quincunxes. Changing an orb does not enable its type. Disabled aspects are excluded from the model, connectors, picking, accessible list, selection events, and relationship details, including when supplied explicitly. Supplied data is validated before filtering. Groups referencing excluded aspects are temporarily omitted; body-only groups remain available. Keep the original input to restore excluded aspects/groups with a later settings change. Invalid references still throw.

`ASPECT_DEFINITIONS` exposes each type's display name, exact angle, default `orb`,
and `major` flag. `ASPECT_ANGLES`, `DEFAULT_ORBS`, and `DEFAULT_ENABLED_ASPECTS`
expose frozen maps. See [model helpers](#model-helpers) for standalone calculations.

```ts
chart.setOptions({ enabledAspects: { semisextile: true, quincunx: true } });
chart.setOptions({ enabledAspects: { square: false }, orbs: { quincunx: 2 } });
// Earlier enablement and orb choices remain in effect.
```

## Model helpers

Import these from `@yuzuwoeser/astr3/model` or `@yuzuwoeser/astr3`. Helpers that accept a model expect one
created by `createModel`; math helpers expect finite degrees.

| Function                                                          | Parameters and result                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `calculateAspects(bodies, orbs?, enabledAspects?): Aspect[]`      | `readonly BodyInput[]` plus optional `OrbConfig` and `AspectEnabledConfig`, defaulting to `{}`. Returns calculated contacts using the defaults above. Validates settings; use `createModel` for full chart validation/normalization and frozen output. |
| `getSelectionDetails(model, selection): SelectionDetails \| null` | Looks up a `Selection` in a `ChartModel` and returns its immediate relationships; unknown references return `null`. See [details](#events-and-details).                                                                                                |
| `hasSelection(model, selection): boolean`                         | Whether the referenced kind/ID exists in the model.                                                                                                                                                                                                    |
| `selectionKey(selection): string`                                 | Stable kind-and-ID key for application maps; does not check existence.                                                                                                                                                                                 |
| `normalize(degrees): number`                                      | Wrap into `[0, 360)`.                                                                                                                                                                                                                                  |
| `signedDistance(from, to): number`                                | Shortest signed change in `[-180, 180)`; an exact half-turn is `-180`.                                                                                                                                                                                 |
| `angularDistance(a, b): number`                                   | Shortest unsigned separation in `[0, 180]`.                                                                                                                                                                                                            |
| `zodiacPosition(longitude): ZodiacPosition`                       | Sign name, zero-based index, and degree within sign.                                                                                                                                                                                                   |
| `formatPosition(longitude): string`                               | Position rounded to the nearest arcminute, carrying into the next sign when needed; for example, `formatPosition(120)` is `0°00′ Leo`.                                                                                                                 |

`SIGNS` and `SIGN_GLYPHS` are frozen Aries-to-Pisces arrays. `BODY_GLYPHS` is a
frozen body-ID-to-symbol map for the ten planets, nodes, AC/MC, and Chiron.
Glyph availability does not imply the provider calculates that body.
Transit helpers and types are listed in [the transit reference](transits.md#headless-helpers).

## Renderer

`createChart(container: HTMLElement, options: ChartOptions): Chart` mounts its own
root inside the container. Give the container a nonzero width. It resizes as a
square with an accessible object list below the wheel. Creation needs a browser
document; graphics use WebGL 2. A WebGL failure retains the HTML list and is
reported through `error`. The returned chart exposes:

| Member                                       | Behavior                                                                                                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `model`, `selection`, `element`, `error`     | Current normalized model, selected reference, mounted root, and graphics error.                                                                |
| `update(data)`                               | Replace data; preserve a still-existing selected ID, or clear it with source `update`.                                                         |
| `setOptions(options)`                        | Patch display, orb, and enablement options. Recalculate omitted aspects; filter supplied aspects by enablement. Clear removed selections.      |
| `select(reference)`                          | Select `{ kind: 'body' \| 'house' \| 'aspect' \| 'group', id }`, or pass `null` to clear. Unknown references throw `RangeError`.               |
| `clearSelection()`                           | Deselect.                                                                                                                                      |
| `zoomBy(factor)`, `resetView()`              | Multiply zoom (clamped to 0.6–5) or restore zoom/pan. Invalid factors throw.                                                                   |
| `on(event, listener)`                        | Subscribe; returns an unsubscribe function.                                                                                                    |
| `exportSvg(options?)`, `exportPng(options?)` | Return `Promise<string>` or `Promise<Blob>`; see [export options](#svg-and-png-export).                                                        |
| `dispose()`                                  | Remove owned DOM, observers/listeners, queued frames, geometry/materials, renderer, and WebGL context. Safe twice; subsequent mutations throw. |

`update`, `setOptions`, selection, and view methods return `void`. Data updates
preserve the camera and still-existing selections. Subscribe through `on` rather
than DOM custom events. Read [events and details](#events-and-details) for payloads.

### Options

- `layout`: `'default'` (library and demo default) or `'alternative'`, typed as `ChartLayout`. Both constructors and `setOptions` accept it. Invalid values throw `RangeError` before changing live state. See [Layout presets](#layout-presets).
- `chartWeight`: `light` (library default), `regular`, or `bold`. Changes chart strokes, label weight, and symbol strokes. Crowded labels may choose a smaller font to fit the measured weight. The demo starts at Regular and provides a Chart weight selector. Invalid values throw `RangeError`; invalid option updates leave the previous settings intact.
- `theme`: patch background, foreground, muted, ring, accent, group, the four element colors (fire, earth, air, water), and per-type aspect colors. Defaults to `DARK_THEME`; exported `DARK_THEME` and `LIGHT_THEME` provide complete palettes.
- `glyphs`: body-ID-to-text overrides, falling back to the body's glyph, built-in symbol, or two name characters. Strings are text, never injected HTML. Use short glyphs.
- `layers`: patch `zodiac`, `bodies`, `houses`, `axes`, `aspects`, `groups`, `degrees`; all default true. Hidden layers remain available in the model and accessible list.
- `bodyVisibility`: a `BodyVisibility` record mapping original body IDs to booleans, for example `{ moon: false, 'north-node': false }`. Omitted IDs are visible. Constructor options are copied; `setOptions` merges patches by ID, and `true` restores a hidden body. Unknown IDs retain their setting for future data updates. Invalid records/values throw before changing the chart. Hiding a body removes its glyph, markers, leaders, and wheel pick targets, plus aspects and group outlines involving it. Model data, relationships, house occupancy, selection, and accessible entries remain available; hidden body entries say “hidden on wheel.” AC/MC axis guides remain controlled by `layers.axes`, but their captions no longer select a hidden point. Visibility changes never request new ephemeris calculations.
- `enabledAspects`: patch aspect-to-boolean settings as described above. This excludes aspect data; the `layers.aspects` switch only hides graphics.
- `lineStyles`: per aspect type `{ width?, dash?: [onPixels, offPixels] }`, in CSS pixels. Width is the baseline before the chart-weight multiplier; dash lengths stay constant. Major types default to solid lines, minor types to `[4, 3]` dashes. Use `[1, 0]` to make a minor aspect solid.
- `selectionEffects`: `{ color?, dimOpacity?, lineWidth? }`, defaulting to theme accent, `0.22`, and `2.5` pixels. Use opacity in `[0, 1]` and positive widths.
- `dimUnrelated`: defaults to `true`; set `false` to keep unrelated objects at normal opacity.
- `ariaLabel`: accessible chart name; defaults to title.

Nested option records patch by key. A per-aspect line-style object replaces that aspect's previous style. Primary selection takes precedence over transient hover highlighting. Theme overrides remain partial; applications implementing a complete `ChartTheme` must include colors for all eleven aspect types.

Chart weight applies to strokes and symbols as well as text, including selection
line width. See the [weight profiles](architecture.md#label-placement-and-typography)
for exact multipliers.

```ts
import type { ChartWeight } from '@yuzuwoeser/astr3';

const chartWeight: ChartWeight = 'bold';
chart.setOptions({ chartWeight });
chart.setOptions({ chartWeight: 'regular', glyphs: { sun: '☉' } });
```

## JSON templates

Templates are versioned JSON presets for appearance at chart creation. Load JSON
in your application, validate it with the matching synchronous helper, and spread
the result into constructor options:

```ts
import template from './my-chart.json';
import { createChart, resolveChartTemplate } from '@yuzuwoeser/astr3';

const chart = createChart(container, {
  ...resolveChartTemplate(template),
  data,
  ariaLabel: 'Natal chart',
});
```

```json
{
  "version": 1,
  "name": "Midnight",
  "kind": "natal",
  "options": {
    "layout": "alternative",
    "chartWeight": "regular",
    "theme": { "background": "#101827", "accent": "#a8e6cf" },
    "layers": { "degrees": false }
  }
}
```

`version`, `kind`, and `options` are required. Version must be the number `1`;
`kind` is `'natal'` or `'transit'`. `name` is an optional string for application
display. The name does not become the accessible chart name. An empty `options`
object is valid; every omitted setting retains its existing renderer default
(including default layout, light chart weight, and `DARK_THEME`).

| Helper exported from `@yuzuwoeser/astr3`                                   | Result                                                              |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `resolveChartTemplate(input: unknown): ChartTemplateOptions`               | Validate a natal template and return copied presentation options.   |
| `resolveTransitChartTemplate(input: unknown): TransitChartTemplateOptions` | Validate a transit template and return copied presentation options. |

`ChartTemplate` and `TransitChartTemplate` type the envelopes. The returned option
types pick presentation fields from `ChartOptions` and `TransitChartOptions`:

| Options                                                                            | Natal                                       | Transit                                                                                                             |
| ---------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `layout`, `chartWeight`, `theme`, `lineStyles`, `selectionEffects`, `dimUnrelated` | Same shapes as [renderer options](#options) | Same shapes as natal                                                                                                |
| `glyphs`                                                                           | Body-ID-to-string record                    | `{ natal?: record, transit?: record }`                                                                              |
| `bodyVisibility`                                                                   | Body-ID-to-boolean record                   | `{ natal?: record, transit?: record }`                                                                              |
| `layers`                                                                           | Partial `ChartLayers`                       | Partial `TransitLayers`, including `natalBodies`, `transitBodies`, `natalAspects`, `crossAspects`, `transitAspects` |
| `transitColor`                                                                     | Unavailable                                 | Color string; omitted uses the theme's group color                                                                  |

Colors must be opaque `#rgb`/`#rrggbb`, a Three.js named color (case insensitive),
or the renderer's comma-separated `rgb()` or `hsl()` syntax. Alpha channels, CSS
variables, and external assets are unsupported. Theme `elements` has exactly four
colors in fire/earth/air/water order. Aspect maps accept only the eleven existing
aspect types. Widths and dash-on lengths must be finite and positive; dash-off
lengths must be finite and nonnegative (`[1, 0]` is solid). `dimOpacity` must be
finite and within `[0, 1]`. Body-ID keys must contain a non-whitespace character.
Glyph strings are text and retain the usual [export font limits](#svg-and-png-export).

All objects and arrays in the result are independent copies, including nested
theme records, tuples, and transit source maps. Resolving does not freeze or
mutate input and does not add defaults. Helpers return only `options`, excluding
the envelope. They are synchronous and SSR-safe, accept parsed objects, and do
no fetching, file access, or storage. Applications supply chart data, calculation
settings/orbs, aspect enablement, and accessible names separately. Templates
exclude those fields, custom geometry, inheritance, and executable content.

Invalid templates throw `ChartTemplateError`, with `name: 'ChartTemplateError'`,
`code: 'INVALID_CHART_TEMPLATE'`, `path`, and a message including the path.
Paths identify the offending field, for example `version`, `kind`,
`options.theme.accent`, or `options.lineStyles.trine.dash[1]`; `$` identifies an
invalid root. Body IDs that need quoting use brackets, such as
`options.glyphs["custom.point"]`. Unknown fields at any fixed level, missing
required fields, unsupported versions, wrong helper/kind combinations, and
invalid values are rejected. Explicit `null` or `undefined` is not omission.

The package includes the strict schema at `@yuzuwoeser/astr3/chart-template.schema.json`:

```ts
import schema from '@yuzuwoeser/astr3/chart-template.schema.json' with { type: 'json' };
```

Use a draft 2020-12 validator or configure your editor to reference this asset.
The schema covers both variants and disallows additional fields; configure an
editor's schema association outside the template rather than adding `$schema`
to the envelope. Runtime resolution also checks that the kind matches the helper.

Ordinary object-spread precedence applies: later properties override earlier
ones, and nested objects are replaced rather than deeply merged. For example,
`{ ...preset, theme: { accent: '#abcdef' } }` discards the preset's other theme
overrides, which then fall back to library defaults. Merge deliberately to retain
them:

```ts
const preset = resolveChartTemplate(template);
const chart = createChart(container, {
  ...preset,
  theme: { ...preset.theme, accent: '#abcdef' },
  data,
  ariaLabel: 'Natal chart',
});
```

Constructors and `setOptions` keep their existing behavior. Template replacement
and hot reload are outside v1; create a fresh chart to choose another preset.
See the [runnable JSON templates example](https://yuzuwoeser.github.io/astr3/examples/json-templates/)
for natal/transit usage and downloadable JSON, and [integration guidance](integrations.md#json-appearance-presets)
for application loading and PHP-to-JSON usage.

## SVG and PNG export

Both mounted chart types expose `exportSvg(options?): Promise<string>` and
`exportPng(options?): Promise<Blob>`. Exports are generated entirely in the browser;
SVG contains vector shapes and outlined text, and PNG rasterizes that same SVG.
Export does not capture the WebGL canvas and also works when WebGL is unavailable.

```ts
import type { ChartExportOptions, ChartPngExportOptions } from '@yuzuwoeser/astr3';

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
saving. For SVG, create a Blob with MIME type `image/svg+xml`, create an object
URL, and revoke it after download. The demo's [download controls](transits.md#demo-controls)
use their own output sizes; they do not change library defaults.

## Events and details

| Event       | Payload                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `selection` | `{ selection, details, source }`, source is `pointer`, `keyboard`, `programmatic`, or `update`. Selection/details can be null. |
| `hover`     | `{ selection, details, x, y }`, client coordinates for application HTML tooltips. Null on leaving the wheel.                   |
| `update`    | `{ model }` after data/options change.                                                                                         |
| `view`      | `{ zoom, pan: { x, y } }`; zoom is relative to the fitted view, pan is in world units.                                         |
| `error`     | `{ code, message, cause? }`; code is `WEBGL_UNAVAILABLE` or `CONTEXT_LOST`. Check `chart.error` for current state.             |
| `dispose`   | `undefined`, emitted once when disposal starts, so companion controllers can release their resources.                          |

`on<K extends keyof ChartEvents>(event: K, listener: (payload: ChartEvents[K]) => void)`
returns an unsubscribe function. Listeners run synchronously, except the initial
graphics-failure notification is queued so immediate subscribers receive it.
`hover` coordinates are viewport/client CSS pixels; cleared hover events use
`selection: null`, `details: null`, and zero coordinates. Ignore coordinates when
there is no hovered selection.

`Selection` is `{ kind: 'body' | 'house' | 'aspect' | 'group', id: string }`.
`SelectionDetails` has this shape:

| Field                           | Meaning                                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selection: Selection`          | Selected kind and original ID.                                                                                                                      |
| `object: ChartObject`           | Selected `Body`, `House`, `Aspect`, or `GroupInput`.                                                                                                |
| `bodies: readonly Body[]`       | Selected/member bodies plus endpoints of included aspects.                                                                                          |
| `houses: readonly House[]`      | The selected house and houses occupied by included bodies.                                                                                          |
| `aspects: readonly Aspect[]`    | A body's immediate aspects, the selected aspect, or a group's supplied aspect references. House selection alone does not expand occupants' aspects. |
| `groups: readonly GroupInput[]` | The selected group and groups directly referencing included bodies/aspects.                                                                         |

Relationship expansion is immediate, not recursive. For no selection, event
`selection` and `details` are both `null`. Headless `getSelectionDetails` also
returns `null` for an unknown reference; renderer `select` throws instead.

Selection events include programmatic changes and selected-data refreshes. Render panels idempotently; avoid unconditionally calling `select` from a selection listener.

## Layout presets

`layout: 'default'` places natal houses inside the zodiac and transit labels outside it. `layout: 'alternative'` puts the actual house band outermost and zodiac signs immediately inside it. The natal ruler and symbols follow inside the zodiac; in a bi-wheel, the transit ruler/symbols come first, then the natal ruler/symbols. Both sources project onto one separate central aspect circle. The outer source ruler shares the zodiac's inner boundary, and both rulers use the same zodiac degrees rather than house-relative degrees.

Alternative house dividers, highlights and picking stay within the outer annulus. Unknown or hidden houses leave that space reserved without invented annotations. House numbers that cannot fit their actual sector are omitted; the band and accessible house entries remain selectable. A natal-only chart uses an expanded single symbol band; both modes keep bounded packing, captions, and overflow behavior.

Alternative ruler dots stay on their source boundary and short leaders connect displaced symbols. A faint dashed radial guide connects an active body to its inner anchor; active aspects/groups guide their members. Guides add no picking targets. Natal/transit colors and inner circle/diamond markers retain their existing meaning. The inner aspect circle remains independent of house visibility.

```ts
import type { ChartLayout } from '@yuzuwoeser/astr3';

const layout: ChartLayout = 'alternative';
chart.setOptions({ layout });
chart.setOptions({ layout: 'default' });
```

Changing layout preserves data, stable selection IDs, zoom/pan, themes and aspect settings. Normal option-update events still apply; no ephemeris calculation is requested. Each preset fits its own outer bounds, including axis captions. Switching back restores default placement for the same data/view. Layout is not part of `ChartInput` or the headless model; arbitrary ring reordering and radius controls are not exposed.

## Input and accessibility

Click/tap to select; click empty space or press Escape to clear. Drag to pan; scroll/pinch or use buttons to zoom. Ctrl/Cmd wheel is left to the browser. Default orientation puts the ascendant at left, or Aries at left when unknown. Zodiac longitude advances counterclockwise.

In the default layout, the house circle uses the original inner placement, with house numbers just inside it. House cusps share the zodiac degree scale; select a house to inspect its exact cusp position. The zodiac has degree ticks on both inside and outside edges, with numbers when space permits. There is no duplicated house-degree scale.

Every planet or supplied point has a filled inner anchor dot at its exact longitude, including bodies without aspects. Aspect lines and supplied group outlines meet those anchors. In the default layout, zodiac position dots sit directly on the zodiac's inner boundary for natal bodies and its outer boundary for transits. Moving a label never moves either marker.

Conjunctions use inward bows; when anchor dots overlap, the connector is hidden.
The aspect remains selectable through the object list/API. Other aspect types
use straight connectors. See [conjunction geometry](architecture.md#conjunction-geometry)
for the rendering algorithm.

Anchor dots select the same body and expose the same hover/selection details as its symbol. They share relationship highlighting, dimming, theme colors, and chart weight, with a 6 CSS pixel picking radius for mouse and 12 for touch. Overlapping dots open the object chooser. The `bodies` layer controls the dots alongside symbols and outer markers; dots remain at the same radius when houses are hidden or unknown and when aspects are hidden.

Labels stay within their source band and within 30° of their true longitude.
Crowded views omit secondary captions, reduce glyph size, then use count badges
that open a chooser of original bodies. Enter/Space opens a focused badge;
Escape closes the chooser and returns focus. Zooming or resizing can expand
badges into individual symbols. Exact dots and accessible entries remain
selectable even when no label fits. Hidden position and retrograde captions
remain available in selection/hover details and **Explore chart objects**.
See [label placement and typography](architecture.md#label-placement-and-typography)
for solver details and size thresholds.

Screen-space priority: body labels/markers → aspects → group interiors → houses. Aspect tolerance is 8 CSS pixels with mouse and 14 with touch. Ties at the highest matching priority produce a chooser. Three or more noncollinear group members define a convex interior; degenerate groups remain selectable in the list/API.

Expand **Explore chart objects** for native buttons carrying position/orb text and `aria-pressed`. Tab moves normally; arrows/Home/End move within the list; Enter/Space selects. A live region announces selection. With wheel focus, `+`, `-`, and `0` zoom/reset. Camera movement is immediate, and label transitions respect reduced motion.

The list survives graphics loss. Initial WebGL failure emits asynchronously for immediate subscribers. Recovery clears `chart.error` and redraws; browsers cannot guarantee every context can recover.

## Calculation API

Import from `@yuzuwoeser/astr3/ephemeris`. `createAstronomyProvider(): AstronomyProvider`
creates a stateless local adapter implementing `EphemerisProvider` plus UTC-only
transit calculation. No chart is mounted or updated automatically.

| Method                                                                                                         | Result                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `calculate(request: CalculationRequest, options?: { signal?: AbortSignal }): Promise<ChartInput>`              | Ten planets, two true lunar nodes, and natal AC/MC bodies, axes, and houses when defined. Default house system is `'placidus'`. |
| `calculateTransits(request: { utc: Date \| string }, options?: { signal?: AbortSignal }): Promise<ChartInput>` | The same planets and nodes, without location-dependent axes or houses.                                                          |

`CalculationRequest` requires `utc`, `latitude` in `[-90, 90]` (north positive),
and `longitude` in `[-180, 180]` (east positive). Optional `houseSystem` is
`'placidus' | 'whole-sign' | 'equal'` (`HouseSystem`); optional `timeUncertain`
defaults to `false`. When true, the adapter uses the reference instant but omits
houses/axes/AC/MC and adds a warning.

Both methods accept a valid `Date` or timestamp with `Z`/explicit offset, within
1900–2100 UTC. Bad dates, coordinates, or house systems reject with
`CalculationError` (`code: 'CALCULATION_ERROR'`, `message`). Aborting rejects with
the signal's reason. Cancellation is checked around synchronous calculation; it
does not interrupt engine work mid-body. Unsupported polar houses return a
status and warning rather than silently switching systems. See
[conventions and measured limits](calculations.md) before relying on precision.

### Standalone house calculation

`calculateHouses(siderealDegrees, latitude, obliquity, system): HouseCalculation`
accepts **local apparent sidereal angle**, geographic latitude, and true obliquity
in degrees, plus a required `HouseSystem`. It does not accept UTC or geographic
longitude: callers must calculate local sidereal angle themselves.

`HouseCalculation` contains `status: 'available' | 'unavailable'`, `angles`,
optional `houses`, and optional `reason`. Available results have twelve cusps;
unavailable results omit houses but retain any defined axes. Invalid/nonfinite
coordinates, latitude outside ±90°, obliquity outside `(0, 90)`, or an unsupported
system throw `RangeError`. The sidereal angle is normalized into `[0, 360)`.
House geometry and polar limits are explained in [calculations](calculations.md#house-geometry).

## Exported types

Type-only imports are supported from the same entry point as their associated
functions. This index groups related types; the sections above describe fields
and behavior rather than duplicating declarations.

| Entry point                                          | Types                                                                                                                             | Reference                                        |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `@yuzuwoeser/astr3/model` (also `@yuzuwoeser/astr3`) | `ChartInput`, `BodyInput`, `HouseInput`, `AspectInput`, `GroupInput`, `ChartAngles`, `HouseStatus`, `AspectType`                  | [Input](#model)                                  |
| `@yuzuwoeser/astr3/model` (also `@yuzuwoeser/astr3`) | `ChartModel`, `Body`, `House`, `Aspect`, `ZodiacPosition`                                                                         | [Normalized results](#normalized-results)        |
| `@yuzuwoeser/astr3/model` (also `@yuzuwoeser/astr3`) | `ModelOptions`, `OrbConfig`, `AspectEnabledConfig`                                                                                | [Aspects](#aspects-and-enablement)               |
| `@yuzuwoeser/astr3/model` (also `@yuzuwoeser/astr3`) | `Selection`, `ChartObject`, `SelectionDetails`                                                                                    | [Selection details](#events-and-details)         |
| `@yuzuwoeser/astr3/model` (also `@yuzuwoeser/astr3`) | `CalculationRequest`, `EphemerisProvider`, `HouseSystem`                                                                          | [Calculation API](#calculation-api)              |
| `@yuzuwoeser/astr3/model` (also `@yuzuwoeser/astr3`) | Transit data, reference, selection, and option types                                                                              | [Transit type index](transits.md#exported-types) |
| `@yuzuwoeser/astr3`                                  | `Chart`, `ChartOptions`, `ChartLayers`, `BodyVisibility`, `ChartLayout`, `ChartWeight`, `ChartTheme`, `ThemeOptions`, `LineStyle` | [Renderer](#renderer)                            |
| `@yuzuwoeser/astr3`                                  | `ChartEvents`, `ChartError`                                                                                                       | [Events](#events-and-details)                    |
| `@yuzuwoeser/astr3`                                  | `ChartExportOptions`, `ChartPngExportOptions`                                                                                     | [Export](#svg-and-png-export)                    |
| `@yuzuwoeser/astr3`                                  | `ChartTemplate`, `TransitChartTemplate`, `ChartTemplateOptions`, `TransitChartTemplateOptions`                                    | [JSON templates](#json-templates)                |
| `@yuzuwoeser/astr3`                                  | Transit renderer and animation types                                                                                              | [Transit type index](transits.md#exported-types) |
| `@yuzuwoeser/astr3/ephemeris`                        | `AstronomyProvider`, `HouseCalculation`, `EphemerisProvider`, `CalculationRequest`, `HouseSystem`                                 | [Calculation API](#calculation-api)              |
