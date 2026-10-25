# ASTR3

[Browser demo on GitHub Pages](https://yuzuwoeser.github.io/astr3/) · [Deployment and preview](docs/github-pages.md)

<img src="https://raw.githubusercontent.com/yuzuwoeser/astr3/main/demo/public/brand/astr3-logo-preview.svg" alt="ASTR3" width="320" />

Explorable astrology wheels for the browser. A framework-neutral TypeScript library built with Three.js, released under MIT.

Select a planet, point, house, aspect, or supplied configuration. Highlight its relationships and connect the selection to your own explanations, tables, tooltips, or panels. Rendering works with precomputed data; the optional browser adapter calculates a natal chart without a backend.

## Use the library

Use Node.js 24 LTS (minimum 22.12.0) and npm. The package is not yet published to npm;
build a tarball from a checkout:

```sh
npm ci
npm pack
# In your application:
npm install /path/to/astr3-0.1.0.tgz three
```

Mount after the host element exists. For example, add this HTML to a page served
by your application's bundler:

```html
<div id="wheel" style="width: min(100%, 640px)"></div>
<pre id="details"></pre>
```

```ts
import { createChart } from 'astr3';

const host = document.querySelector<HTMLElement>('#wheel');
const panel = document.querySelector<HTMLElement>('#details');
if (!host || !panel) throw new Error('Mount #wheel and #details first.');

const chart = createChart(host, {
  data: {
    bodies: [
      { id: 'sun', name: 'Sun', longitude: 0 },
      { id: 'moon', name: 'Moon', longitude: 120 },
      { id: 'jupiter', name: 'Jupiter', longitude: 240 },
    ],
    // Omit aspects to calculate enabled types with configurable orbs.
    // Supply [] to deliberately display none.
  },
});

const unsubscribe = chart.on('selection', ({ details }) => {
  panel.textContent = details ? JSON.stringify(details, null, 2) : 'Select an object';
});

chart.select({ kind: 'body', id: 'sun' });
// Call from your application's unmount handler.
function unmount() {
  unsubscribe();
  chart.dispose();
}
```

The wheel resizes as a square; the accessible object list stays below it in document
flow. Importing `astr3` is SSR-safe; interactive graphics need a browser and WebGL 2.
If WebGL is unavailable, the HTML object list remains usable and `chart.error`
explains the failure. For data-only use in Node or workers, import `astr3/model`.

## Optional browser calculation

```sh
npm install astronomy-engine
```

```ts
import { createAstronomyProvider } from 'astr3/ephemeris';

const provider = createAstronomyProvider();
const data = await provider.calculate({
  utc: '2000-01-01T12:00:00Z',
  latitude: 51.5074,
  longitude: -0.1278, // east positive
  houseSystem: 'placidus',
});

// Reuse the mounted chart from the previous example.
chart.update(data);
```

`astr3/model` is a headless entry with no DOM, Three.js, or ephemeris imports. `astr3/ephemeris` imports Astronomy Engine but not Three.js. Renderers and selections never request new calculation data automatically. Any provider implementing `EphemerisProvider` can replace the example adapter.

## Capabilities

- Natal and transit wheels with arbitrary supplied planets/points, unequal house
  cusps, independent AC/MC axes, and unknown-house support.
- Eleven aspect types with independent enablement and orbs; supplied aspects and
  configuration groups remain under the caller's control.
- Exact longitude markers, bounded label placement, overlap choosers, touch/keyboard
  selection, and an accessible HTML object list.
- Two layouts, themes, chart weights, custom glyphs, layers, and per-body visibility.
- Browser [SVG/PNG export](docs/api.md#svg-and-png-export) and opt-in
  [transit animation](docs/transits.md#animated-time-steps) with reduced-motion support.

The initial API is versioned 0.x and may change before 1.0. Automatic patterns, synastry, standalone transit houses, multi-selection, continuous time playback, 3D presentation, and framework wrappers are deferred.

## Natal + transit bi-wheels

Use `createTransitChart` with `{ data: { natal, transit } }`. Both sides accept
`ChartInput`; IDs remain local to their chart. Selections include `chart: 'natal'`
or `'transit'`, and cross-aspect selections use `'cross'`. Houses and axes come
from the natal chart. See the [working example and transit API](docs/transits.md).

## Run the demo

From a checkout, run `npm ci` and `npm run dev`, then open the Vite URL. The initial
wheel uses synthetic teaching data with a supplied grand trine. Choose a preset or
enter UTC time and coordinates to calculate locally with Astronomy Engine.

Choose **Natal + transits** for time stepping and optional animation. **Aspects**
sets enablement and orbs; **Celestial bodies** controls individual visibility.
Layout, theme, and chart weight affect presentation. Birth information is never
sent to a calculation service. See [demo time controls](docs/transits.md#demo-controls)
for transit-specific behavior.

## Documentation and validation

- [Agent integration: headless data and browser lifecycle](docs/agent-integration.md)
- [API, exported helpers, events, and data contracts](docs/api.md)
- [Transit bi-wheel API](docs/transits.md)
- [Calculation conventions and tested accuracy](docs/calculations.md)
- [Architecture and integration](docs/architecture.md)
- [Contributing and local setup](CONTRIBUTING.md)
- [Instructions for repository coding agents](AGENTS.md)
- [Documentation index for LLMs](llms.txt)
- [Release and privacy checklist](docs/releasing.md)
- [Security reporting](SECURITY.md) and [changelog](CHANGELOG.md)

Run `npm run check` and `npm run format:check` for local validation. Browser tests
run separately with `npm run test:browser`; setup and coverage limits are in
[Contributing](CONTRIBUTING.md).

## License and assets

ASTR3 source is MIT licensed. Dependency and bundled font attribution is in
[NOTICE](NOTICE). The Righteous wordmark font and Noto export outlines retain
their SIL OFL licenses. Reusable logos and palette specifications are in the
[brand asset notes](https://github.com/yuzuwoeser/astr3/blob/main/demo/public/brand/README.txt).
