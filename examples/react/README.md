## React integration

This example targets React 19.3; pinned dependencies are included in the starter.

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

Copy **Wheel.tsx** from the source below into your application. It imports only ASTR3
and your framework, includes host sizing, and accepts a `data` prop/input. Use it:

```tsx
import { Wheel } from './Wheel';

const data = {
  bodies: [
    { id: 'sun', name: 'Sun', longitude: 0 },
    { id: 'moon', name: 'Moon', longitude: 120 },
    { id: 'jupiter', name: 'Jupiter', longitude: 240 },
  ],
};

// Inside your component:
return <Wheel data={data} />;
```

The positions above are invented. Replace them with your `ChartInput`.

### Update

Pass new data to the existing component. It calls `chart.update(data)` rather
than creating a new renderer. Use `setOptions` for settings in an extended wrapper.

### Cleanup

Removing the component disposes its chart. The mount effect owns cleanup; a separate effect updates data. React Strict Mode setup/cleanup is supported.
Importing ASTR3 is SSR-safe; creating a chart belongs after browser mounting.
An accessible object list remains available when WebGL cannot start.

### Full example and validation

The live preview adds optional rotate and unmount/remount controls. `App`/`main`,
`shared/data.ts`, and `shared/preview.css` support that demo; they are not required
when copying the component. Browser tests cover updates and remount cleanup.
The standalone starter flattens its data/styles and includes compiler configuration.

### Develop this repository

Use Node.js 24 LTS. Run `npm ci` and `npm run dev` at the repository root; open
`/previews/react/`. Restart dev after editing an example to rebuild its preview.
