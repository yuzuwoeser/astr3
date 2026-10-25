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
JavaScript, TypeScript, or framework guides. It uses the public `astr3`,
`astr3/model`, and optional `astr3/ephemeris` entry points. ASTR3 is currently
installed from a locally packed tarball; it is not yet published to npm.

All built-in chart fixtures use invented teaching positions or documented public
reference dates/locations. Chart input stays in the browser.
