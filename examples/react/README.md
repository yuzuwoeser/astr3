## React integration

React 19.3, using effects and Strict Mode. This preview is compiled from the source files shown below, against
a locally packed ASTR3 package. Framework/compiler dependencies live in this
example's workspace; they are not dependencies of the ASTR3 library.

### Run from this checkout

Use Node.js 24 LTS. From the repository root:

```sh
npm ci
npm run dev
```

Open `/previews/react/` or use the live preview above. After changing an example,
restart `dev` to rebuild its preview.

### Use in your application

ASTR3 has not yet been published to npm. Run `npm pack` in this repository, then
install the resulting tarball and `three` in your application. The example
manifest's `file:../..` dependency is for this checkout; replace it with the path
to your tarball when copying the example.

Copy `Wheel.tsx` and its imports. `shared/data.ts` contains invented teaching
positions and can be replaced with your own `ChartInput`; `shared/preview.css`
is application styling, not a required library stylesheet. Install
`astronomy-engine` separately only when using `astr3/ephemeris`.

### Mount, update, dispose

Create the chart after its host exists in the browser. Give the host a nonzero
width. Update the existing instance when chart data changes, and dispose it
before its host is removed. Keep creation out of server-side rendering.

The controls rotate the synthetic data and unmount/remount the chart. Browser
tests verify that updates reach the rendered labels and remounting leaves one
chart instance. The renderer retains an accessible object list if WebGL fails.

Strict Mode intentionally exercises effect setup and cleanup twice. The mount
effect owns disposal; a separate effect handles updated data.

See [React effects](https://react.dev/reference/react/useEffect).
