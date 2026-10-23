# astr3

Explorable astrology wheels for the browser. A framework-neutral TypeScript library built with Three.js, released under MIT.

Select a planet, point, house, aspect, or supplied configuration. Highlight its relationships and connect the selection to your own explanations, tables, tooltips, or panels. Rendering works with precomputed data; the optional browser adapter calculates a natal chart without a backend.

## Run the demo

Use Node.js 24 LTS (minimum 22.12.0) and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The initial wheel uses synthetic teaching data with a supplied grand trine. Choose a calculated preset or enter a UTC date/time and coordinates to use Astronomy Engine. House systems: Placidus, Whole Sign, Equal. Birth information is never sent to a service. **Aspects** provides individual switches, editable orbs, and Major only / All / None presets. Choose **Natal + transits** for an outer transit band, UTC time stepping, and independent aspect settings for natal, transit-to-natal, and transit-to-transit contacts. **Chart weight** offers Light, Regular (demo default), and Bold.

## Use the library

In transit view, enable **Animate time changes** to follow calculated motion between Previous/Next steps, from hours through years. Pause/Resume stops at the displayed time; turning animation off finishes the step immediately. The reusable [`createTransitAnimation` controller](docs/transits.md#animated-time-steps) preserves retrograde paths with adaptive sampling and honors reduced motion.

This repository produces an npm-ready package; npm publication is pending. Install the local package tarball in an application:

```sh
npm pack
# In your application:
npm install /path/to/astr3/astr3-0.1.0.tgz three
```

```ts
import { createChart } from 'astr3';

const chart = createChart(document.querySelector<HTMLElement>('#wheel')!, {
  chartWeight: 'regular', // Omit to preserve the library's original Light styling.
  layout: 'alternative', // Omit for the original 'default' arrangement.
  enabledAspects: { semisextile: true, quincunx: true },
  data: {
    bodies: [
      { id: 'sun', name: 'Sun', longitude: 78.4 },
      { id: 'moon', name: 'Moon', longitude: 198.9 },
      { id: 'jupiter', name: 'Jupiter', longitude: 318.1 },
    ],
    // Omit aspects to calculate enabled types with configurable orbs.
    // Supply [] to deliberately display none.
  },
});

const unsubscribe = chart.on('selection', ({ details }) => {
  // Render application-owned HTML here. Data includes signs, houses, and orbs.
  console.log(details?.object, details?.aspects);
});

chart.select({ kind: 'body', id: 'sun' });
// Later, when your view unmounts:
unsubscribe();
chart.dispose();
```

Give the container a nonzero width. The wheel resizes as a square; the accessible object list stays below it in document flow. Instantiate after the container mounts, and dispose before removing it. Importing `astr3` is SSR-safe; creating a chart needs a browser and WebGL 2. If WebGL is unavailable, the interactive HTML object list remains usable and `chart.error` explains the failure.

## Optional browser calculation

```sh
npm install astronomy-engine
```

```ts
import { createAstronomyProvider } from 'astr3/ephemeris';

const controller = new AbortController();
const provider = createAstronomyProvider();
const data = await provider.calculate(
  {
    utc: '2000-01-01T12:00:00Z',
    latitude: 51.5074,
    longitude: -0.1278, // east positive
    houseSystem: 'placidus',
  },
  { signal: controller.signal },
);

chart.update(data);
```

`astr3/model` is a headless entry with no DOM, Three.js, or ephemeris imports. `astr3/ephemeris` imports Astronomy Engine but not Three.js. Renderers and selections never request new calculation data automatically. Any provider implementing `EphemerisProvider` can replace the example adapter.

## Included in v0.1

- Two layouts: `default` keeps the original wheel; `alternative` puts houses outermost, zodiac second, and natal/transit symbols inside the zodiac, with a separate inner aspect circle. Choose **Chart layout** in the demo or call `chart.setOptions({ layout: 'alternative' })`.
- Western natal wheels, arbitrary supplied points/cusps, independent AC/MC axes, degree labels, retrograde indicators, and unknown-house support.
- Selectable Ascendant, Midheaven, North Node, and South Node with the same dots, aspects, house occupancy, and detail events as planets. The browser provider includes true lunar nodes in natal/transit calculations and AC/MC in natal calculations when defined.
- Collision-separated glyphs and leader lines with fixed longitude markers. Planet labels stay outside the original inner house circle and clear of the outer degree scale; collective one/two-row placement stays within 30° of true positions. Crowded views hide captions first, then shrink symbols or show selectable cluster badges. Wheel text uses zoom-aware size presets.
- Selectable planet dots on the house circle at exact longitudes, joined by aspect lines and pattern outlines. Every planet has a dot, including those without aspects.
- Eleven aspect types with independent enablement and orbs: five major aspects enabled by default, plus semi-sextile, semi-square, quintile, sesquiquadrate, biquintile, and quincunx. Disabled types leave the model, explorer, and relationship details. Supplied groups have selectable interiors and accessible entries.
- Pointer/touch selection, overlap chooser, relationship highlights, application HTML tooltip events, and programmatic selection.
- Zoom/pan/reset, keyboard controls, an accessible HTML object list, and reduced-motion behavior.
- Dark/light themes, Light/Regular/Bold chart weight, custom glyph strings, aspect line widths/dashes, layers, dimming, and selection styles.
- Validated data updates, resource disposal, and recovery after WebGL context restoration.

The initial API is versioned 0.x and may change before 1.0. Automatic patterns, synastry, standalone transit houses, multi-selection, time playback, export, 3D presentation, and framework wrappers are deferred.

## Natal + transit bi-wheels

```ts
import { createTransitChart } from 'astr3';
import { createAstronomyProvider } from 'astr3/ephemeris';

const provider = createAstronomyProvider();
const natal = await provider.calculate({
  utc: '2000-01-01T12:00:00Z',
  latitude: 51.5074,
  longitude: -0.1278,
});
const transit = await provider.calculateTransits({ utc: '2026-10-21T12:00:00Z' });
const wheel = createTransitChart(document.querySelector<HTMLElement>('#wheel')!, {
  data: { natal, transit },
  orbs: { cross: { conjunction: 5 } },
  enabledAspects: { cross: { quincunx: true, semisextile: true } },
  layers: { crossAspects: true, natalAspects: false, transitAspects: false },
});
wheel.select({ kind: 'body', chart: 'transit', id: 'mars' });
wheel.on('selection', ({ details }) => console.log(details));
// Updating time leaves natal data, camera and configuration fixed.
wheel.updateTransit(await provider.calculateTransits({ utc: '2026-10-22T12:00:00Z' }));
// Unmount: wheel.dispose();
```

Both sides also accept precomputed `ChartInput`. Planet IDs remain local to their chart: natal Mars and transiting Mars can both use `mars`. The inner wheel uses natal houses/axes; transit bodies expose their `natalHouse`. Distinct central anchor dots keep aspect lines out of the zodiac and label bands. See [the transit API](docs/transits.md) for configuration, selection, and calculation contracts.

## Documentation and validation

- [Agent integration: headless data and browser lifecycle](docs/agent-integration.md)
- [API and data contracts](docs/api.md)
- [Transit bi-wheel API](docs/transits.md)
- [Calculation conventions and tested accuracy](docs/calculations.md)
- [Architecture and integration](docs/architecture.md)
- [Contributing and local setup](CONTRIBUTING.md)
- [Instructions for repository coding agents](AGENTS.md)
- [Documentation index for LLMs](llms.txt)
- [Release and privacy checklist](docs/releasing.md)
- [Security reporting](SECURITY.md) and [changelog](CHANGELOG.md)

```sh
npm run check             # types, unit/reference tests, builds, packed consumer
npm exec playwright -- install chromium
npm run test:browser      # real WebGL: Chromium desktop + mobile touch emulation
npm run format:check
```

Stop any unrelated server on port 4173 before browser tests; local runs may reuse it. On Linux, install Chromium with `--with-deps`. See [Contributing](CONTRIBUTING.md) for focused test commands.

Browser tests exercise direct selection, overlaps, keyboard access, updates, touch/pinch, resizing, themes/layers, unavailable WebGL, context restoration, and repeated disposal. Independent numerical fixtures cover 1900–2100 and both hemispheres. See the calculation documentation for tolerances and limitations. Tests do not imply the same accuracy at every date, coordinate, or numerical boundary.

MIT. Three.js and Astronomy Engine retain their respective MIT licenses. See [NOTICE](NOTICE).
