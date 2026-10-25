## Angular integration

This example targets Angular 22.2; pinned dependencies are included in the starter.

### Install

Install the npm package in your existing application:

```sh
npm install @yuzuwoeser/astr3 three
```

Or download this page’s **starter ZIP** for a standalone application. It includes
a local tarball and needs no ASTR3 repository checkout. Install `astronomy-engine`
only for optional calculations. Prebuilt tarballs are also available from the
[installation chooser](https://yuzuwoeser.github.io/astr3/integrations/).

### Minimal integration

Copy **wheel.component.ts** from the source below into your application. It imports only ASTR3
and your framework, includes host sizing, and accepts a `data` prop/input. Use it:

```ts
import { Component } from '@angular/core';
import { WheelComponent } from './wheel.component';

@Component({
  selector: 'my-chart',
  standalone: true,
  imports: [WheelComponent],
  template: '<astr3-wheel [data]="data" />',
})
export class MyChart {
  readonly data = {
    bodies: [
      { id: 'sun', name: 'Sun', longitude: 0 },
      { id: 'moon', name: 'Moon', longitude: 120 },
    ],
  };
}
```

The positions above are invented. Replace them with your `ChartInput`.

### Update

Pass new data to the existing component. It calls `chart.update(data)` rather
than creating a new renderer. Use `setOptions` for settings in an extended wrapper.

### Cleanup

Removing the component disposes its chart. The component mounts after view initialization, updates on input changes, and disposes on destruction. Render it only in the browser in SSR applications.
Importing ASTR3 is SSR-safe; creating a chart belongs after browser mounting.
An accessible object list remains available when WebGL cannot start.

### Full example and validation

The live preview adds optional rotate and unmount/remount controls. `App`/`main`,
`shared/data.ts`, and `shared/preview.css` support that demo; they are not required
when copying the component. Browser tests cover updates and remount cleanup.
The standalone starter flattens its data/styles and includes compiler configuration.

### Develop this repository

Use Node.js 24 LTS. Run `npm ci` and `npm run dev` at the repository root; open
`/previews/angular/`. Restart dev after editing an example to rebuild its preview.
