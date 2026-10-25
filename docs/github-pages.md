# GitHub Pages website

The website's publication URL is <https://yuzuwoeser.github.io/astr3/>. Source stays
in `site/`; canonical example code and guides live in `examples/`. Only built
`site-dist/` contents are uploaded. Development and ordinary
`npm run build:site` builds continue using `/`.

## Build and preview

Use Node.js 24 LTS and the committed lockfile:

```sh
npm ci
npm run build:pages
npm run preview:pages
```

Open <http://127.0.0.1:4174/astr3/>. The build uses `--base /astr3/` for the site and
every compiled preview, rewriting scripts, CSS, font preload/font URLs, and lazy-loaded ephemeris
and export chunks. Public assets and licenses keep their relative paths. Do not
edit or commit `site-dist/`. Preview is for local verification; Pages hosts the
production files.

The landing page is `/astr3/`; the complete chart explorer is
`/astr3/playground/`. Examples and integration guides have static routes beneath
`/astr3/examples/` and `/astr3/integrations/`, including direct deep links.
`build:site` builds at `/`; `build:demo` remains its compatibility alias.
The focused selection/transit demonstration lives at `/astr3/examples/selection/`
and runs the same controller as the homepage hero. It uses invented positions
and manual synthetic steps; it does not represent astronomical time progression.
The [marketing kit](../marketing/README.md) documents screenshot/video capture
and the [React guide](../examples/react/README.md) demonstrates an application panel.
`tar` and `zip` are required for packed-library checks and the browser download.

The build reads `examples/registry.mjs`, compiles real framework applications
against an extracted local ASTR3 package, and generates guide pages from their
README/source files. Missing sources/previews and duplicate IDs fail the build.
The browser distribution is emitted to `downloads/browser/` and ZIPped as
`downloads/astr3-browser.zip`; its dependencies and optional ephemeris are
self-hostable. Framework dependencies remain development/example dependencies.

## Production smoke tests

```sh
npm exec playwright -- install chromium
npm run test:pages
```

On Linux CI, install Chromium with `--with-deps`. Stop unrelated servers on port
4174 first; the tests refuse to reuse an existing server. Development-browser
tests continue using port 4173.

`test:pages` rebuilds the Pages output and starts preview for Chromium desktop
and mobile tests. Coverage includes selection, both layouts, local calculations,
transit mode, all three downloads, bundled fonts, branding assets and licenses.
It also checks website navigation, canonical source tabs, every framework
preview, lifecycle cleanup, Rails Turbo visits/cache restoration, and standalone
browser modules with optional calculations.
Tests fail on browser errors, failed requests, or application asset requests
outside `/astr3/`. Results live under `test-results/pages/`, separately from
development-browser results. Run the suites serially and keep source/output files
fixed while browser tests run. CI uploads the exact output tested by this command.

## First publication

After publication is authorized, open **Settings → Pages** in the repository and
set **Build and deployment → Source** to **GitHub Actions**. This creates/configures
the Pages site if necessary. Keep the default Pages domain; no `CNAME`, hosting
account, or custom secret is needed. Restrict the `github-pages` environment to
`main` if configuring its deployment branch policy. Push the verified commit only
when asked.

The **Check** workflow retains all existing checks and history scanning. It builds
and tests the Pages output, then uploads that exact artifact for pushes to `main`
or manual runs on `main`. Deployment requires both `check` and `secrets` to pass.
Only the deployment job receives `pages: write` and `id-token: write`. Pull
requests, forks, and other branches do not publish. Deployments share a concurrency
group without cancelling an active publication; after waiting, a candidate whose
SHA no longer matches `main` is skipped.

To redeploy manually, select **Actions → Check → Run workflow → main**. This reruns
checks and builds a fresh verified artifact. An initial push before Pages setup
may fail at **Configure Pages**; configure the source, then run **Check** manually
on `main`.

## Verify and recover

Follow the environment URL from the successful deployment. Verify the landing
page and integration links, then the playground chart, Righteous wordmark, preset calculation, transit mode, and SVG/PNG downloads.
Chart calculations and inputs remain in the visitor's browser.

For a blank page, missing font, or failed lazy import, inspect network/console
errors and verify asset URLs begin with `/astr3/`, not `/assets/` or `/fonts/`.
Confirm the uploaded directory came from `test:pages` and was not replaced by a
root-base build afterwards. A skipped deployment means a newer commit exists on
`main`; inspect its run. Failed jobs leave the previous site intact. For a live
regression, revert the faulty site change and let the normal workflow validate
and republish it; do not force-push or disable checks.

See [Vite's Pages guide](https://vite.dev/guide/static-deploy.html#github-pages)
and [GitHub's Pages workflow requirements](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
