# API and data contracts

## Model

Import types and pure functions from `astr3/model`. `createModel(input, { orbs? })` validates, normalizes, and freezes its own objects/arrays. It does not mutate or freeze the caller's input. Application metadata is opaque and retained by reference; treat it as immutable.

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

| Aspect type | Exact angle | Default maximum orb |
| ----------- | ----------: | ------------------: |
| conjunction |          0° |                  8° |
| sextile     |         60° |                  4° |
| square      |         90° |                  6° |
| trine       |        120° |                  6° |
| opposition  |        180° |                  8° |

Override limits with `orbs: { trine: 5 }`. Boundaries are inclusive. Overlapping calculated limits choose the closest exact angle. Supplied aspects are not filtered by orb limits. Calculated IDs survive body reordering. `calculateAspects`, `angularDistance`, `signedDistance`, `normalize`, `zodiacPosition`, and `formatPosition` support shared application logic. Aspects use longitude, not three-dimensional separation or declination parallels.

## Renderer

`createChart(container, { data, ...options })` returns:

| Member                                   | Behavior                                                                                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `model`, `selection`, `element`, `error` | Current normalized model, selected reference, mounted root, and graphics error.                                                                |
| `update(data)`                           | Replace data; preserve a still-existing selected ID, or clear it with source `update`.                                                         |
| `setOptions(options)`                    | Patch display options/orbs and recalculate aspects only if the original input omitted them.                                                    |
| `select(reference)`                      | Select `{ kind: 'body' \| 'house' \| 'aspect' \| 'group', id }`. Unknown references throw `RangeError`.                                        |
| `clearSelection()`                       | Deselect.                                                                                                                                      |
| `zoomBy(factor)`, `resetView()`          | Multiply zoom (clamped to 0.6–5) or restore zoom/pan. Invalid factors throw.                                                                   |
| `on(event, listener)`                    | Subscribe; returns an unsubscribe function.                                                                                                    |
| `dispose()`                              | Remove owned DOM, observers/listeners, queued frames, geometry/materials, renderer, and WebGL context. Safe twice; subsequent mutations throw. |

Options:

- `chartWeight`: `light` (library default), `regular`, or `bold`. Changes chart strokes, label weight, and symbol strokes without changing font sizes, colors, or dimming. The demo starts at Regular and provides a Chart weight selector. Invalid values throw `RangeError`; invalid option updates leave the previous settings intact.
- `theme`: patch background, foreground, muted, ring, accent, group, the four element colors, and per-type aspect colors. Exported `DARK_THEME` and `LIGHT_THEME` provide complete palettes.
- `glyphs`: body-ID-to-text overrides, falling back to the body's glyph, built-in symbol, or two name characters. Strings are text, never injected HTML. Use short glyphs.
- `layers`: patch `zodiac`, `bodies`, `houses`, `axes`, `aspects`, `groups`, `degrees`; all default true. Hidden layers remain available in the model and accessible list.
- `lineStyles`: per aspect type `{ width?, dash?: [onPixels, offPixels] }`, in CSS pixels. Width is the baseline before the chart-weight multiplier; dash lengths stay constant.
- `selectionEffects`: `{ color?, dimOpacity?, lineWidth? }`, defaulting to theme accent, `0.22`, and `2.5` pixels. Use opacity in `[0, 1]` and positive widths.
- `dimUnrelated: false`: keep unrelated objects at normal opacity.
- `ariaLabel`: accessible chart name; defaults to title.

Nested option records patch by key. A per-aspect line-style object replaces that aspect's previous style. Primary selection takes precedence over transient hover highlighting.

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

## Events and details

| Event       | Payload                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `selection` | `{ selection, details, source }`, source is `pointer`, `keyboard`, `programmatic`, or `update`. Selection/details can be null. |
| `hover`     | `{ selection, details, x, y }`, client coordinates for application HTML tooltips. Null on leaving the wheel.                   |
| `update`    | `{ model }` after data/options change.                                                                                         |
| `view`      | `{ zoom, pan: { x, y } }`; pan is in world units.                                                                              |
| `error`     | `{ code, message, cause? }`; code is `WEBGL_UNAVAILABLE` or `CONTEXT_LOST`. Check `chart.error` for current state.             |

`SelectionDetails` includes the selected object/reference and related bodies, houses, aspects, and groups. Bodies include sign, degree within sign, and optional house. Aspects include exact angle, actual separation, and absolute orb; applying/separating is not calculated. Groups include supplied bodies plus aspect endpoints. Houses return occupants; bodies return immediate aspects and endpoints without recursive graph expansion.

Selection events include programmatic changes and selected-data refreshes. Render panels idempotently; avoid unconditionally calling `select` from a selection listener.

## Input and accessibility

Click/tap to select; click empty space or press Escape to clear. Drag to pan; scroll/pinch or use buttons to zoom. Ctrl/Cmd wheel is left to the browser. Default orientation puts the ascendant at left, or Aries at left when unknown. Zodiac longitude advances counterclockwise.

The house circle uses the original inner placement, with house numbers just inside it. House cusps share the zodiac degree scale; select a house to inspect its exact cusp position. There is no duplicated house-degree scale.

Every planet or supplied point has a filled anchor dot on this circle at its exact longitude, including bodies without aspects. Aspect lines and supplied group outlines meet those anchors. Nearby or coincident aspect endpoints form a small inward loop so conjunctions remain visible and selectable. The outer longitude markers remain in place; moving a label never moves either marker.

Anchor dots select the same body and expose the same hover/selection details as its symbol. They share relationship highlighting, dimming, theme colors, and chart weight, with a 6 CSS pixel picking radius for mouse and 12 for touch. Overlapping dots open the object chooser. The `bodies` layer controls the dots alongside symbols and outer markers; dots remain at the same radius when houses are hidden or unknown and when aspects are hidden.

The complete planet label stays between the house circle and the outer degree ticks, with a 4 CSS pixel clearance from the boundaries and other labels. Crowded labels may shift around this band; connecting lines lead back to their unchanged longitude markers. This boundary also applies when houses are unknown or hidden.

When full labels cannot fit, the wheel uses compact symbols, hiding the degree/retrograde text without reducing symbol font size. Full labels return when resizing or zooming provides enough space. Position and retrograde information remain available in selection/hover details and **Explore chart objects**. If even a compact symbol cannot fit, its exact marker remains selectable and a “Zoom in to reveal planet symbols” hint appears. The object list always includes every body.

Screen-space priority: body labels/markers → aspects → group interiors → houses. Aspect tolerance is 8 CSS pixels with mouse and 14 with touch. Ties at the highest matching priority produce a chooser. Three or more noncollinear group members define a convex interior; degenerate groups remain selectable in the list/API.

Expand **Explore chart objects** for native buttons carrying position/orb text and `aria-pressed`. Tab moves normally; arrows/Home/End move within the list; Enter/Space selects. A live region announces selection. With wheel focus, `+`, `-`, and `0` zoom/reset. Camera movement is immediate, and label transitions respect reduced motion.

The list survives graphics loss. Initial WebGL failure emits asynchronously for immediate subscribers. Recovery clears `chart.error` and redraws; browsers cannot guarantee every context can recover.
