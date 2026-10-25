## Build a clickable natal chart in React

This example targets React 19.3; pinned dependencies are included in the starter.
You will render an astrology wheel, select a planet or aspect, and display its
relationships in a React panel. [Try the focused selection demo](https://yuzuwoeser.github.io/astr3/examples/selection/)
to see the interaction before installing anything.

### Run the complete starter

Download this page’s **React starter ZIP**, extract it, then run these commands
inside the extracted directory with Node.js 24 LTS:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Select Sun on the wheel, then select Moon:
the panel beneath the chart changes to show that object and its aspects.
**Rotate positions** updates the existing wheel; **Unmount chart** and
**Mount chart** demonstrate cleanup. The ZIP includes its own package, data,
styles and compiler configuration. No ASTR3 checkout is required.

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

### Connect a selection to your own content

The runnable **Wheel.tsx** below stores `SelectionDetails | null` in React state.
Its mount effect subscribes once:

```tsx
const unsubscribe = instance.on('selection', ({ details }) => setDetails(details));
```

`details.object` is the selected object. `details.aspects` contains its immediate
aspect relationships, and `details.bodies` includes their endpoints. The example
uses those IDs to show labels such as **Sun / Moon: trine**. No selection produces
`null`, so render a prompt in that case. A house has a number, an aspect has a type,
and bodies/groups have names; the example handles those shapes explicitly.

The application owns the panel. Add your own explanations, translations, table,
or links around these relationships. ASTR3 supplies selection and highlighting;
it does not generate interpretations. The example's positions are invented and
are not a person's natal chart.

The subscription returns an unsubscribe function. Call it before disposing the
instance in the effect's cleanup. Keep the subscription in the mount effect so
updates do not accumulate listeners. The current example uses an idempotent state
setter; it never calls `select` recursively from the selection listener.

Clicking a wheel label and choosing the same entry in the accessible object list
drive the same panel. Selection also refreshes when the selected data changes.
See the [selection contract](https://github.com/yuzuwoeser/astr3/blob/main/docs/api.md#events-and-details)
for the complete relationship rules.

### Cleanup

Removing the component disposes its chart. The mount effect owns cleanup; a separate effect updates data. React Strict Mode setup/cleanup is supported.
Importing ASTR3 is SSR-safe; creating a chart belongs after browser mounting.
An accessible object list remains available when WebGL cannot start.

### Full example and validation

The live preview includes the selection panel plus rotate and unmount/remount controls. `App`/`main`,
`shared/data.ts`, and `shared/preview.css` support that demo; they are not required
when copying the component. Browser tests cover updates and remount cleanup.
The standalone starter flattens its data/styles and includes compiler configuration.
Production browser tests cover the selection panel, retained selection across
updates, and working selection after a Strict Mode unmount/remount.

### Develop this repository

Use Node.js 24 LTS. Run `npm ci` and `npm run dev` at the repository root; open
`/previews/react/`. Restart dev after editing an example to rebuild its preview.
