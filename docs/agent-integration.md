# Integrating ASTR3 with an agent

This guide is for an agent building an application or inspecting chart data.
For an agent editing ASTR3 itself, use [AGENTS.md](../AGENTS.md).
ASTR3 exposes TypeScript/JavaScript APIs. It does not include an MCP server,
LLM tool endpoint, interpretation service or framework wrapper.

## Choose an entry point

| Need                                                  | Import            | Runtime                                                                |
| ----------------------------------------------------- | ----------------- | ---------------------------------------------------------------------- |
| Validate data, compute aspects, inspect relationships | `astr3/model`     | Node, worker or browser; no DOM, Three.js or ephemeris imports         |
| Mount an interactive natal/transit wheel              | `astr3`           | Import is SSR-safe; mount after the browser host exists, with WebGL 2  |
| Calculate positions, houses and true nodes locally    | `astr3/ephemeris` | Node, worker or browser; requires the optional `astronomy-engine` peer |

Build with `npm ci && npm pack` in a checkout
and install the resulting tarball plus `three` in the consuming application.
Install `astronomy-engine` only if using the adapter. See
[getting started](../README.md#use-the-library). No secret or remote service is required.

## Inspect a chart without graphics

This complete example uses invented positions. It can run in Node as an `.mjs`
file after installing the package:

```js
import { createModel, getSelectionDetails } from 'astr3/model';

const data = {
  title: 'Synthetic trine study',
  bodies: [
    { id: 'sun', name: 'Sun', longitude: 0 },
    { id: 'moon', name: 'Moon', longitude: 120 },
    { id: 'jupiter', name: 'Jupiter', longitude: 240 },
  ],
  groups: [
    {
      id: 'trine-study',
      name: 'Supplied trine group',
      bodyIds: ['sun', 'moon', 'jupiter'],
      aspectIds: [],
    },
  ],
};

const model = createModel(data, { orbs: { trine: 5 } });
const details = getSelectionDetails(model, { kind: 'body', id: 'sun' });
console.log(
  JSON.stringify({
    body: details?.object,
    aspects: details?.aspects,
    houseStatus: model.houseStatus,
  }),
);
```

This produces three exact trines, with Sun details containing its two trines.
Houses are unknown because none were supplied. The group was explicitly supplied;
the library did not detect a grand trine. Select the group with
`{ kind: 'group', id: 'trine-study' }` to inspect its members.

Use model data and relationship details for structured agent outputs. Do not infer
longitudes from screen coordinates: label placement deliberately moves symbols.
An interpretation is application content, not an astronomical result supplied by
ASTR3. Do not claim the library validates an interpretation.

## Mount the same input in a browser

Reuse `data` from the example above. Give the host a nonzero width and mount only
after it exists:

```js
import { createChart } from 'astr3';

const host = document.getElementById('wheel');
const panel = document.getElementById('details');
if (!host || !panel) throw new Error('Mount #wheel and #details first.');

const chart = createChart(host, { data, chartWeight: 'regular' });
const unsubscribe = chart.on('selection', ({ details }) => {
  panel.textContent = details ? JSON.stringify(details, null, 2) : 'Select an object';
});
chart.select({ kind: 'group', id: 'trine-study' });

// Call from the application's unmount handler:
function unmount() {
  unsubscribe();
  chart.dispose();
}
```

The renderer provides its own wheel controls and accessible object list. The host
application owns the details panel, HTML tooltips and explanations. Names, glyph
strings and metadata are data; avoid unsafe HTML interpolation. If WebGL fails,
`chart.error` describes it and the accessible list remains usable. Subscribe to
`error` for later context failures and check current `chart.error`.

Mounted natal and transit charts can export with `await chart.exportSvg()` or
`await chart.exportPng()`. Defaults fit the entire wheel; `{ view: 'current' }`
retains its camera and selection. Exports work during WebGL failure, capture the
current data at call time, and load font outlines only when requested. Unsupported
custom glyphs reject with character details. See [SVG and PNG export](api.md#svg-and-png-export)
for sizing, transparency, font coverage and saving files. There is no standalone
server-rendering/export factory.

Framework integrations should create once after mount, call `update(data)` for
data changes, `setOptions` for settings, and dispose at unmount. Avoid rebuilding
the entire chart for every hover. Selection events can fire on programmatic
selection and data refresh, so do not unconditionally call `select` inside them.

Both browser factories accept `layout: 'default' | 'alternative'`; omit it to keep
the original layout. Call `chart.setOptions({ layout: 'alternative' })` to place
houses outermost, zodiac second and celestial symbols inside it. Transit charts
use an outer transit symbol band and inner natal band, sharing a separate central
aspect circle. Layout changes preserve positions, selections and zoom/pan and do
not calculate new data. This is a renderer option, not a `ChartInput` field or a
headless-model setting. See [layout presets](api.md#layout-presets).

## Connect a calculation provider

```js
import { createAstronomyProvider } from 'astr3/ephemeris';

const provider = createAstronomyProvider();
const controller = new AbortController();
const natal = await provider.calculate(
  {
    utc: '2000-01-01T12:00:00Z',
    latitude: 51.5074,
    longitude: -0.1278,
    houseSystem: 'placidus',
  },
  { signal: controller.signal },
);
```

The timestamp needs `Z` or an explicit offset. Latitude is north positive;
longitude is east positive. The adapter supports 1900–2100, tropical geocentric
positions and true nodes. It does not resolve places, civil time or DST.
See [calculation conventions and limits](calculations.md) before choosing it for
a particular application's precision requirements.

`EphemerisProvider` requires only async `calculate(request, options?)`. Replace it
with a backend or worker adapter returning `ChartInput`, or supply precomputed
data directly. The bundled `AstronomyProvider` additionally has
`calculateTransits({ utc }, options?)`, which omits location-dependent houses/axes.

See the [calculation API](api.md#calculation-api) for complete request/result
signatures, `CalculationError`, and standalone house calculation.

When requests overlap, cancel the previous request and apply only the newest
revision. Cancellation does not interrupt the adapter's synchronous engine work
mid-calculation. Put high-volume calculations in an application-owned worker.
Selection, zoom, orb and visibility changes never call the provider automatically.

## Add transits

With `provider` and `natal` from the previous example:

```js
import { createTransitModel, getTransitSelectionDetails } from 'astr3/model';

const transit = await provider.calculateTransits({ utc: '2026-01-01T12:00:00Z' });
const transitModel = createTransitModel(
  { natal, transit },
  {
    enabledAspects: { cross: { quincunx: true } },
  },
);
const transitDetails = getTransitSelectionDetails(transitModel, {
  chart: 'transit',
  kind: 'body',
  id: 'mars',
});
console.log(transitDetails);
```

For graphics, pass `{ data: { natal, transit } }` to `createTransitChart(host, options)`
from `astr3`. Advance time using `wheel.updateTransit(nextTransitData)` to preserve
the natal model and view. Natal and transit IDs may be the same; selections must
include their source. Use `chart: 'cross'` only for a cross-aspect selection.
Transit bodies expose `natalHouse`; there are no transit-time houses in this mode.

## Avoid common contract mistakes

- Longitudes and orbs use degrees, not radians; speed uses degrees/day.
- Omit `aspects` to calculate them. Supply `[]` to explicitly request none.
- Five major aspect types default on; six minor types default off. Set
  `enabledAspects` to include a minor type. Changing its orb does not enable it.
- Hiding a layer leaves its data in the model. Disabling an aspect type excludes
  it from relationships and dependent supplied groups. Keep the original input
  for restoration rather than passing the filtered model back as input.
- Supply all twelve valid cusps, or omit houses. Unknown time must not invent
  houses. Point bodies such as AC/MC must be supplied explicitly in precomputed data.
- Stable IDs preserve selections across updates. Invalid data/options throw and
  leave the previous chart intact. Catch provider errors separately from
  `ChartDataError` and browser graphics errors.
- Models do not mutate caller data. Metadata is retained by reference; treat it
  as immutable. Do not include private birth information in logs or tool transcripts.

## Verify the integration

Validate input with `createModel` or `createTransitModel` before mounting. Check
the relevant selection details headlessly, then verify a real browser selection
updates the host panel and unmount disposes the chart. Test a narrow viewport,
keyboard selection, unknown houses, disabled aspects and unavailable WebGL for
applications that expose those states.

The repository's `npm run test:package` checks the built tarball in an isolated
consumer. Full API signatures and defaults remain in [api.md](api.md) and
[transits.md](transits.md); use them when this guide omits an option.
