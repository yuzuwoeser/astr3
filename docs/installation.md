# Installing ASTR3

Choose the distribution that fits your application. All distributions use the
same ASTR3 version and browser renderer.

| Your application                                | Installation                                                | Start here                                                            |
| ----------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| JavaScript, TypeScript, or a frontend framework | `npm install @yuzuwoeser/astr3 three` or a prebuilt tarball | [Integration guides](integrations.md)                                 |
| An HTML website without a build pipeline        | Extract the browser ZIP and serve it over HTTP/HTTPS        | `minimal.html` inside the download                                    |
| WordPress 6.5+ / PHP 8+                         | Upload and activate the WordPress plugin ZIP                | Insert an **ASTR3 Chart** block                                       |
| PHP or another server-rendered site             | Browser modules plus safely encoded chart JSON              | [PHP starter](https://yuzuwoeser.github.io/astr3/integrations/php/)   |
| Rails with Stimulus/Turbo                       | npm tarball or self-hosted browser modules                  | [Rails guide](https://yuzuwoeser.github.io/astr3/integrations/rails/) |

## Prebuilt downloads

The [installation chooser](https://yuzuwoeser.github.io/astr3/integrations/)
provides npm, browser, WordPress, and complete per-stack starter downloads from
the current website build. No ASTR3 source checkout is required.

```sh
npm install @yuzuwoeser/astr3 three
```

Install `astronomy-engine` separately only if using `@yuzuwoeser/astr3/ephemeris`.
The prebuilt `astr3-X.Y.Z.tgz` release assets contain the same scoped package.
`npm pack` in a checkout uses npm’s default `yuzuwoeser-astr3-X.Y.Z.tgz` filename;
release downloads deliberately retain their existing `astr3-X.Y.Z.tgz` filenames.

[GitHub Releases](https://github.com/yuzuwoeser/astr3/releases) will hold immutable
versioned distributions when a release tag is published. Each release includes
`astr3-X.Y.Z.tgz`, `astr3-browser-X.Y.Z.zip`, `astr3-wordpress-X.Y.Z.zip`, starter
ZIPs, `manifest.json` with the source commit, and `SHA256SUMS`. Verify downloaded
files with `shasum -a 256 -c SHA256SUMS` (or `sha256sum -c SHA256SUMS` on Linux).
Download all listed files before checking the complete checksum list.

Website downloads follow the current `main` build and can change before a
release; use GitHub Release assets to pin a published version.

## Browser and CMS packages

Keep browser modules, lazy export chunks and notices together. Optional
calculations use the separate `ephemeris.js`. `minimal.html` uses inline invented
data; `index.html` demonstrates optional controls, export and calculations.
Neither requires a CDN. Opening through `file://` is unsupported.

The WordPress ZIP includes its dependencies and appearance presets. In the
editor, paste chart JSON, choose a preset and preview before publishing. Data
is stored in page/post content and becomes public on publication. For transits,
paste `{ "natal": ChartInput, "transit": ChartInput }`.

Update WordPress by uploading a newer ZIP using its plugin replacement flow.
There is no custom automatic updater or WordPress.org listing. Other CMS bundles
are planned, not currently supported.

## Starter downloads

JavaScript, TypeScript, React, Vue, Svelte, Angular and Rails browser starters
include the local ASTR3 tarball and their own application/compiler files. Extract,
run `npm install`, then `npm run dev` using Node.js 24 LTS. PHP includes browser
assets and runs through your PHP server. Framework components contain host sizing;
demo styles and rotate/remount controls are optional when copying a component.

For local source development or an unpublished change, `npm ci && npm pack`
remains available. Install that generated tarball and `three` in the consumer.
