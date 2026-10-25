## Add a chart without a build pipeline

Download **Browser bundle** from the website home page and extract the ZIP into
a directory you can serve over HTTP/HTTPS. Open its `index.html` for a working
example. No npm installation, CDN, API key, or frontend compilation is required.

The download contains `astr3.js`, its lazy export modules, `embed.js`,
`chart-data.json`, example HTML/JavaScript/styles, licenses, and the optional
`ephemeris.js` calculation adapter. Keep the emitted files together.

### Minimal integration

Start with **minimal.html** from the download: it contains a host, inline invented
data, and a direct `createChart` call. Copy those into your page and adjust the
module URL. The full demo in `index.html` adds optional controls and external data.

### Update and cleanup

The host needs a nonzero width. Call `chart.update(nextData)` when data changes
and `chart.dispose()` before replacing/removing its container. Chart labels are
HTML owned by the library; the surrounding page owns its controls and details.

### Optional calculations and downloads

The example demonstrates SVG/PNG downloads and dynamically imports the separate
calculation adapter for the public J2000 reference. Calculations and exports run
locally. You can omit the ephemeris module if your server already supplies
positions, but retain the export chunks if you expose downloads.

### Validation

The production browser tests exercise this self-contained distribution, data
updates, removal/remounting, SVG/PNG exports, and optional calculations. Use a
modern browser with JavaScript and WebGL 2; an accessible object list remains
available if WebGL cannot start. Local `file://` loading is unsupported.
