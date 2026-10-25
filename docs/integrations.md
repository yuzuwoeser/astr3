# Framework and website integrations

The [ASTR3 website](https://yuzuwoeser.github.io/astr3/integrations/) presents
runnable examples and integration guides. Their source and setup instructions
live in [examples/](https://github.com/yuzuwoeser/astr3/tree/main/examples), not in
duplicated website snippets. The core package remains framework-independent.

| Integration              | Approach                                                          |
| ------------------------ | ----------------------------------------------------------------- |
| JavaScript / TypeScript  | Mount, update data, and dispose through the public browser API    |
| HTML without build tools | Download self-hostable ES modules with bundled dependencies       |
| React 19                 | Effects and cleanup, including Strict Mode                        |
| Vue.js 3                 | Composition API, watched props, mount/unmount hooks               |
| Svelte 5                 | Runes, data effects, and mount cleanup                            |
| Angular 22               | AOT-compiled standalone component, input updates, and destruction |
| PHP 8                    | Safely encoded JSON in server-rendered HTML                       |
| WordPress 6.5+           | Child-theme template and script-module enqueue recipe             |
| Rails 8                  | Stimulus 3 controller and Turbo 8 cache/navigation lifecycle      |

The versions above identify the examples' targets, not a blanket compatibility
promise. Framework packages are pinned in the example manifests and root
lockfile. Backend recipes describe their runtime-validation limits explicitly.
Drupal and installable CMS plugins are not included.

## Browser distribution

[Download the browser bundle](https://yuzuwoeser.github.io/astr3/downloads/astr3-browser.zip),
extract it, and serve the directory over HTTP/HTTPS. The included HTML page
works without npm, a CDN, or a build pipeline. `astr3.js` includes the rendering
dependencies, while `ephemeris.js` is a separate optional calculation module.
Keep emitted lazy modules and license notices with the download. Serve modules
with a JavaScript MIME type. Opening through `file://` is unsupported.

This is an application distribution built for the website, not a new npm export.
Normal npm consumers continue to use `astr3`, `astr3/model`, and
`astr3/ephemeris`, with their existing peer dependencies. Until npm publication,
install from a local tarball as described in [getting started](../README.md#use-the-library).

## Data and lifecycle

Servers supply `ChartInput` as JSON; rendering runs in the browser. Mount after
the host exists with nonzero width, update the existing chart as data changes,
and dispose it before removing the host. Do not initialize charts during SSR.
For Turbo or other partial navigation, clean up before caching or replacing DOM.
Use platform JSON encoders and escape for the HTML context rather than inserting
server data into executable JavaScript.

The website loads live previews on demand in isolated iframes. PHP/WordPress
previews reuse the browser embed; the Rails preview runs its actual Stimulus
controller and Turbo navigation. GitHub Pages does not run backend servers.

See [the examples contributor guide](https://github.com/yuzuwoeser/astr3/blob/main/examples/README.md)
for adding an example. API contracts remain in [api.md](api.md),
[transits.md](transits.md), and [calculations.md](calculations.md).
