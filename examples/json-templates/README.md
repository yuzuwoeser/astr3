## JSON templates

Save chart appearance in versioned JSON, validate it, and spread the returned
options into a new chart. Choose Midnight, Paper, or Transit study in the live
preview. Every choice disposes the previous chart and creates a fresh instance.
The natal positions are identical invented teaching data in all three previews;
the transit example adds a second invented set offset by 4° to show cross aspects.

### Run it

From the repository root, run `npm ci` and `npm run dev`, then open
`/previews/json-templates/`. The build uses the packed library. Copy this folder
and `examples/shared/` into a Vite application to adapt it; install the ASTR3
tarball and `three` as described in the main README.

### Natal usage

```ts
import template from './midnight.json';
import { createChart, resolveChartTemplate } from '@yuzuwoeser/astr3';

const chart = createChart(container, {
  ...resolveChartTemplate(template),
  data,
  ariaLabel: 'Natal chart',
});
```

### Transit usage

```ts
import template from './transit.json';
import { createTransitChart, resolveTransitChartTemplate } from '@yuzuwoeser/astr3';

const chart = createTransitChart(container, {
  ...resolveTransitChartTemplate(template),
  data: { natal, transit },
  ariaLabel: 'Natal and transit chart',
});
```

The transit template uses source-specific glyphs and body visibility. Transiting
Jupiter is hidden on the wheel but remains in **Explore chart objects**. Its
`layers` control graphics; aspect enablement stays with your application.

Use **Download JSON** to save the selected preset and **Download SVG** to export
its chart. The source tabs below show the actual templates and running code.
Omitted settings keep renderer defaults. Later object-spread properties override
earlier ones, and a later nested object replaces that entire nested object.
Templates do not include chart data, calculation settings, or accessible names.

The [API reference](https://github.com/yuzuwoeser/astr3/blob/main/docs/api.md#json-templates)
documents every allowed field, `ChartTemplateError.path`, and the strict schema
exported as `@yuzuwoeser/astr3/chart-template.schema.json`. Loading JSON belongs to your
application; the resolvers are synchronous and safe to import during SSR.
