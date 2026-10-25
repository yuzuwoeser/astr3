## JavaScript integration

### Install

Download this page’s **starter ZIP** for a standalone application, or install the
[prebuilt npm tarball](https://yuzuwoeser.github.io/astr3/downloads/astr3-0.1.0.tgz)
in your existing application:

```sh
npm install https://yuzuwoeser.github.io/astr3/downloads/astr3-0.1.0.tgz three
```

npm registry publication is pending. After publication the equivalent command is
`npm install astr3 three`. The starter includes a local tarball and needs no
ASTR3 repository checkout. Install `astronomy-engine` only for optional calculations.

### Minimal integration

Add `<div id="wheel" style="width: min(100%, 640px)"></div>` to your page.
Run this module after the element exists:

```js
import { createChart } from 'astr3';

const data = {
  bodies: [
    { id: 'sun', name: 'Sun', longitude: 0 },
    { id: 'moon', name: 'Moon', longitude: 120 },
    { id: 'jupiter', name: 'Jupiter', longitude: 240 },
  ],
};
const chart = createChart(document.getElementById('wheel'), { data });
```

These positions are invented. No library stylesheet is required.

### Update

Call `chart.update(nextData)` for positions and `chart.setOptions(options)` for
settings. Keep the instance instead of creating another chart on every change.

### Cleanup

Call `chart.dispose()` before removing the host. Mount only in the browser;
ASTR3 imports are SSR-safe. WebGL failure retains an accessible object list.

### Full example and validation

The preview source adds optional rotation and remount controls. Shared fixtures,
styles and Vite configuration support the demo, not the minimal integration.
Browser tests verify rendered updates and cleanup. The starter ZIP is complete
and independent of this checkout.

### Develop this repository

Use Node.js 24 LTS. Run `npm ci` then `npm run dev` at the repository root and
open `/previews/javascript/`. Restart dev to rebuild changed examples.
