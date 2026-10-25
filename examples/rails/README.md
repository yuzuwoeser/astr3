## Ruby on Rails with Stimulus and Turbo

This recipe targets Rails 8.x applications using Stimulus 3.2 and Turbo 8. The
browser preview uses the actual Stimulus controller and Turbo navigation. It is
built as a static browser application; GitHub Pages does not run a Rails server.
Ruby syntax is checked where available. Full Rails rendering/database integration
is not covered by this suite.

### Run the browser example

From the repository root:

```sh
npm ci
npm run dev
```

Open `/previews/rails/`. Rotate positions, unmount/remount, then navigate away and
return with Turbo or the browser Back button.

### Add to a Rails application

1. Build ASTR3 with `npm pack` in this checkout. In a Rails application using
   jsbundling-rails, install that local tarball, `three`, `@hotwired/stimulus`, and
   `@hotwired/turbo` with the application's package manager. ASTR3 is not yet
   published to npm.
2. Copy `chart_controller.js` into `app/javascript/controllers/`. Keep the
   application's existing Stimulus startup and register the controller as `chart`
   if automatic controller loading is not configured. Do not start a second
   Stimulus application; `main.js` is only the standalone browser preview entry.
3. Use `charts_controller.rb` and the ERB partial as a starting point. Add a
   `resource :chart, only: :show` route, and copy the browser download's public
   `chart-data.json` into `config/` for this synthetic example.
4. Include the shared styles or give the chart host your own nonzero width.

For importmap-rails instead, self-host the downloaded browser modules and pin
`astr3` to the URL of `astr3.js`. Keep its lazy chunks at their emitted relative
paths. The Stimulus controller can retain its existing `astr3` import.

### Data and lifecycle

Pass `ChartInput` as a Stimulus object value. Rails' `tag` helper escapes the JSON
attribute; do not mark JSON as `html_safe`. The controller updates the existing
chart when the value changes, disposes it on disconnect, and disposes before
Turbo caches the page so snapshots contain no stale canvas or generated labels.

See [Stimulus lifecycle callbacks](https://stimulus.hotwired.dev/reference/lifecycle-callbacks)
and [Turbo caching](https://turbo.hotwired.dev/handbook/building#understanding-caching).
