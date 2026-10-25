## Full chart playground

Explore supplied teaching data, or calculate documented public reference charts
locally with Astronomy Engine. Try natal/transit views, two layouts, body and
aspect controls, selection, zoom, and SVG/PNG downloads.

### Run from this checkout

```sh
npm ci
npm run dev
```

Open `/playground/` at the printed URL. The website builds this page directly from
these files. Its forms, details panels, time controls, and explanations belong
to the application, not the library API.

### Reuse it

This is a complete application example. For a small integration, start with the
JavaScript, TypeScript, or framework guides. It uses the public `@yuzuwoeser/astr3`,
`@yuzuwoeser/astr3/model`, and optional `@yuzuwoeser/astr3/ephemeris` entry points. Install it with `npm install @yuzuwoeser/astr3 three` in your own application.

All built-in chart fixtures use invented teaching positions or documented public
reference dates/locations. Chart input stays in the browser.
