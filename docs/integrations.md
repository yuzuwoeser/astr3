# Framework and website integrations

The [ASTR3 website](https://yuzuwoeser.github.io/astr3/integrations/) presents
runnable examples and integration guides. Their source and setup instructions
live in [examples/](https://github.com/yuzuwoeser/astr3/tree/main/examples), not in
duplicated website snippets. The core package remains framework-independent.

| Integration              | Approach                                                             |
| ------------------------ | -------------------------------------------------------------------- |
| JavaScript / TypeScript  | Mount, update data, and dispose through the public browser API       |
| HTML without build tools | Download self-hostable ES modules with bundled dependencies          |
| React 19                 | Effects and cleanup, including Strict Mode                           |
| Vue.js 3                 | Composition API, watched props, mount/unmount hooks                  |
| Svelte 5                 | Runes, data effects, and mount cleanup                               |
| Angular 22               | AOT-compiled standalone component, input updates, and destruction    |
| PHP 8                    | Safely encoded JSON in server-rendered HTML                          |
| WordPress 6.5+           | Installable block/shortcode plugin, plus optional child-theme recipe |
| Rails 8                  | Stimulus 3 controller and Turbo 8 cache/navigation lifecycle         |

The versions above identify the examples' targets, not a blanket compatibility
promise. Framework packages are pinned in the example manifests and root
lockfile. Backend recipes describe their runtime-validation limits explicitly.
An installable WordPress ZIP is also provided; Drupal and Joomla packages are
planned in the [coverage roadmap](integration-roadmap.md).

## Choose your installation

Start with the [installation chooser](https://yuzuwoeser.github.io/astr3/integrations/):
npm package for applications, browser ZIP for plain websites, or
WordPress plugin ZIP. Each integration page includes an independent starter or
plugin download and puts minimal usage before the optional full demo.

## Browser distribution

[Download the browser bundle](https://yuzuwoeser.github.io/astr3/downloads/astr3-browser.zip),
extract it, and serve the directory over HTTP/HTTPS. The included `minimal.html` starter and full `index.html` demo
work without npm, a CDN, or a build pipeline. `astr3.js` includes the rendering
dependencies, while `ephemeris.js` is a separate optional calculation module.
Keep emitted lazy modules and license notices with the download. Serve modules
with a JavaScript MIME type. Opening through `file://` is unsupported.

Shared browser modules power the website downloads and CMS bundles.
Normal npm consumers use `@yuzuwoeser/astr3`, `@yuzuwoeser/astr3/model`, and `@yuzuwoeser/astr3/ephemeris`, with their
existing peer dependencies, plus the `@yuzuwoeser/astr3/chart-template.schema.json` asset
when validating JSON presets in an editor or another tool. Install with
`npm install @yuzuwoeser/astr3 three`, or use a prebuilt tarball or starter from the
[installation guide](installation.md). No ASTR3 source checkout is required.

## Data and lifecycle

Servers supply `ChartInput` as JSON; rendering runs in the browser. Mount after
the host exists with nonzero width, update the existing chart as data changes,
and dispose it before removing the host. Do not initialize charts during SSR.
For Turbo or other partial navigation, clean up before caching or replacing DOM.
Use platform JSON encoders and escape for the HTML context rather than inserting
server data into executable JavaScript.

The website loads example live previews on demand in isolated iframes. PHP/WordPress
previews reuse the browser embed; the Rails preview runs its actual Stimulus
controller and Turbo navigation. GitHub Pages does not run backend servers.

## JSON appearance presets

The [JSON templates example](https://yuzuwoeser.github.io/astr3/examples/json-templates/)
includes natal/transit usage, live charts, and downloadable presets. The
homepage's two previews use those same JSON files with identical invented data.
The [API reference](api.md#json-templates) defines the complete format, strict
schema, errors, defaults, and shallow object-spread override behavior.

Bundlers can import JSON directly. Without a JSON loader, let the application
fetch it before chart creation (use `./astr3.js` from the browser download in
place of the package import):

```js
import { createChart, resolveChartTemplate } from '@yuzuwoeser/astr3';

const response = await fetch('./midnight.json');
if (!response.ok) throw new Error(`Template load failed: ${response.status}`);
const appearance = resolveChartTemplate(await response.json());
const chart = createChart(host, { ...appearance, data, ariaLabel: 'Natal chart' });
```

PHP can keep a preset on disk or construct the same JSON envelope as an array.
Encode it into non-executable JSON alongside your separately encoded chart data:

```php
<?php
$template = json_decode(file_get_contents(__DIR__ . '/midnight.json'), false, 512, JSON_THROW_ON_ERROR);
$templateJson = json_encode($template, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR);
?>
<script type="application/json" id="chart-template"><?= $templateJson ?></script>
```

```js
import { createChart, resolveChartTemplate } from './astr3/astr3.js';

const template = JSON.parse(document.getElementById('chart-template').textContent);
const chart = createChart(host, {
  ...resolveChartTemplate(template),
  data, // ChartInput loaded separately, as in the PHP recipe.
  ariaLabel: 'Natal chart',
});
// Retain chart and dispose it before replacing this part of the page.
```

Decoding with `false` preserves JSON objects, including empty option maps. Use
`(object) []` for empty maps if constructing the envelope in PHP.

Keep PHP's JSON encoding flags when embedding JSON in HTML. Template validation
is performed in the browser by ASTR3; the PHP snippet only loads and encodes the
file. ASTR3 does no loading or storage itself. Use the transit helper and template
variant when mounting `createTransitChart`.

See [the examples contributor guide](https://github.com/yuzuwoeser/astr3/blob/main/examples/README.md)
for adding an example. API contracts remain in [api.md](api.md),
[transits.md](transits.md), and [calculations.md](calculations.md).
