# ASTR3

[Project website and playground](https://yuzuwoeser.github.io/astr3/) · [Deployment and preview](docs/github-pages.md)

<img src="https://raw.githubusercontent.com/yuzuwoeser/astr3/main/site/public/brand/astr3-logo-preview.svg" alt="ASTR3" width="320" />

Explorable astrology wheels for the browser. A framework-neutral TypeScript library built with Three.js, released under MIT.

Select a planet, point, house, aspect, or supplied configuration. Highlight its relationships and connect the selection to your own explanations, tables, tooltips, or panels. Rendering works with precomputed data; the optional browser adapter calculates a natal chart without a backend.

## Use the library

Choose an installation route in the [installation guide](docs/installation.md):
npm package, a browser ZIP without build tools, or an installable WordPress
plugin. Use Node.js 24 LTS (minimum 22.12.0) for bundled applications:

```sh
npm install @yuzuwoeser/astr3 three
```

The npm package is `@yuzuwoeser/astr3`. Browser downloads keep the `astr3.js`
filename. For unpublished local changes, run `npm ci && npm pack` in a checkout
and install the generated `yuzuwoeser-astr3-0.1.1.tgz` tarball. Framework starter
ZIPs include a local tarball and their own application files.

Mount after the host element exists. For example, add this HTML to a page served
by your application's bundler:

```html
<div id="wheel" style="width: min(100%, 640px)"></div>
<pre id="details"></pre>
```

```ts
import { createChart } from '@yuzuwoeser/astr3';

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
flow. Importing `@yuzuwoeser/astr3` is SSR-safe; interactive graphics need a browser and WebGL 2.
If WebGL is unavailable, the HTML object list remains usable and `chart.error`
explains the failure. For data-only use in Node or workers, import `@yuzuwoeser/astr3/model`.

## Optional browser calculation

```sh
npm install astronomy-engine
```

```ts
import { createAstronomyProvider } from '@yuzuwoeser/astr3/ephemeris';

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

`@yuzuwoeser/astr3/model` is a headless entry with no DOM, Three.js, or ephemeris imports. `@yuzuwoeser/astr3/ephemeris` imports Astronomy Engine but not Three.js. Renderers and selections never request new calculation data automatically. Any provider implementing `EphemerisProvider` can replace the example adapter.

## Capabilities

- Natal and transit wheels with arbitrary supplied planets/points, unequal house
  cusps, independent AC/MC axes, and unknown-house support.
- Eleven aspect types with independent enablement and orbs; supplied aspects and
  configuration groups remain under the caller's control.
- Exact longitude markers, bounded label placement, overlap choosers, touch/keyboard
  selection, and an accessible HTML object list.
- Two layouts, themes, chart weights, custom glyphs, layers, and per-body visibility.
- Reusable [JSON appearance templates](docs/api.md#json-templates) with synchronous
  validation, copied options, and a packaged JSON Schema for natal/transit charts.
- Browser [SVG/PNG export](docs/api.md#svg-and-png-export) and opt-in
  [transit animation](docs/transits.md#animated-time-steps) with reduced-motion support.

The initial API is versioned 0.x and may change before 1.0. Automatic patterns, synastry, standalone transit houses, multi-selection, continuous time playback, 3D presentation, and framework wrappers are deferred.

## Natal + transit bi-wheels

Use `createTransitChart` with `{ data: { natal, transit } }`. Both sides accept
`ChartInput`; IDs remain local to their chart. Selections include `chart: 'natal'`
or `'transit'`, and cross-aspect selections use `'cross'`. Houses and axes come
from the natal chart. See the [working example and transit API](docs/transits.md).

## Website, playground, and integrations

From a checkout, run `npm ci` and `npm run dev`, then open the Vite URL and choose **Playground**. The initial
wheel uses synthetic teaching data with a supplied grand trine. Choose a preset or
enter UTC time and coordinates to calculate locally with Astronomy Engine.

Choose **Natal + transits** for time stepping and optional animation. **Aspects**
sets enablement and orbs; **Celestial bodies** controls individual visibility.
Layout, theme, and chart weight affect presentation. Birth information is never
sent to a calculation service. See [demo time controls](docs/transits.md#demo-controls)
for transit-specific behavior.

The website includes runnable JavaScript/TypeScript, React, Vue.js, Svelte, and
Angular examples, plus HTML, PHP, WordPress, and Ruby on Rails integration guides.
[Integration overview](docs/integrations.md) explains the browser download and
canonical examples. `site/` owns the website; `examples/` owns the source shown
in its guides. `npm run dev` builds previews before starting Vite; restart it
after changing an example.

Choose [JSON templates](https://yuzuwoeser.github.io/astr3/examples/json-templates/)
for a live preview and downloadable appearance presets. Import a JSON file and
spread `resolveChartTemplate(template)` into `createChart` options, followed by
your own `data` and `ariaLabel`. Transit charts use `resolveTransitChartTemplate`.
See the [template API](docs/api.md#json-templates) for validation and overrides.

## Documentation and validation

- [Installation and release downloads](docs/installation.md)
- [Framework, CMS, and server-rendered integrations](docs/integrations.md)
- [Integration coverage roadmap](docs/integration-roadmap.md)
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
[brand asset notes](https://github.com/yuzuwoeser/astr3/blob/main/site/public/brand/README.txt).
