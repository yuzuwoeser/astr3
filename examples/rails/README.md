## Ruby on Rails with Stimulus and Turbo

This recipe targets Rails 8.x applications using Stimulus 3.2 and Turbo 8. The
browser preview uses the actual Stimulus controller and Turbo navigation. It is
built as a static browser application; GitHub Pages does not run a Rails server.
Ruby syntax is checked where available. Full Rails rendering/database integration
is not covered by this suite.

### Install

Download this page’s **starter ZIP** to run the Stimulus/Turbo browser demo, or
install the npm package into an existing Rails app with jsbundling-rails:

```sh
npm install @yuzuwoeser/astr3 three @hotwired/stimulus @hotwired/turbo
```

For importmap-rails, self-host the browser
bundle and pin `@yuzuwoeser/astr3` to its `astr3.js` URL, retaining the emitted relative chunks.

### Minimal integration

Copy `chart_controller.js` into `app/javascript/controllers/`. Keep existing
Stimulus startup and register it as `chart` if automatic loading is absent.
Use the ERB partial and Rails controller below with `resource :chart, only: :show`.
The starter includes invented `config/chart-data.json`. Give the host a nonzero width.
`main.js`, `index.html`, and `away.html` are browser-demo scaffolding, not Rails files.

### Update and cleanup

Pass `ChartInput` as a Stimulus object value. Rails' `tag` helper escapes the JSON
attribute; do not mark JSON as `html_safe`. The controller updates the existing
chart when the value changes, disposes it on disconnect, and disposes before
Turbo caches the page so snapshots contain no stale canvas or generated labels.

See [Stimulus lifecycle callbacks](https://stimulus.hotwired.dev/reference/lifecycle-callbacks)
and [Turbo caching](https://turbo.hotwired.dev/handbook/building#understanding-caching).

### Develop this repository

Use Node.js 24 LTS. Run `npm ci` then `npm run dev`; open `/previews/rails/`.
The preview tests the actual Stimulus controller and Turbo navigation. The
standalone starter also runs with `npm install` and `npm run dev`.
