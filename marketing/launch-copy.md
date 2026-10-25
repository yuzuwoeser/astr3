# Launch copy and technical answers

These drafts are for accounts and communities that permit assisted writing.
Adapt them to your own experience and follow [community-specific rules](communities.md).
Do not paste them onto Hacker News or r/webdev, whose rules prohibit generated text.
Publish only after the demo and tutorial routes are live.

## Reusable description

ASTR3 is an MIT-licensed TypeScript library for interactive astrology charts.
Select a planet or aspect, highlight its relationships, and connect the selection
to your own explanations, tables and tools. It supports natal/transit wheels,
supplied chart data, optional browser calculations, and SVG/PNG export.

## Short announcement

ASTR3: interactive astrology charts for your app.
Select a planet → highlight its connections → update your own explanation panel.
MIT + TypeScript, with runnable starters.

Try it: https://yuzuwoeser.github.io/astr3/examples/selection/

Attach `selection-demo.png`. Use this version where a short post is appropriate;
do not add a feature inventory or multiple competing calls to action.

## Longer introduction

I'm sharing ASTR3, an MIT-licensed TypeScript library for interactive astrology
charts. The interaction is the useful part: selecting a planet or aspect gives
your application the object and its immediate relationships, so a chart can drive
your own explanation panel, table or navigation.

It renders supplied positions, so you can keep your existing calculation source.
There is also an optional Astronomy Engine adapter for local calculations.
Natal/transit wheels, appearance templates, accessible selection and SVG/PNG export
are included. The API is currently experimental, version 0.x.

Here's a small demo with invented positions and manual transit steps:
https://yuzuwoeser.github.io/astr3/examples/selection/

The runnable React example shows the selection subscription, state updates and
cleanup: https://yuzuwoeser.github.io/astr3/integrations/react/

If you're building an astrology website or learning tool, what would prevent you
from using this chart in it?

## Three.js showcase

Title: **ASTR3: selectable astrology wheels with Three.js and HTML labels**

I'm sharing ASTR3, a TypeScript library that renders interactive astrology wheels
with Three.js. The labels and accessible object list are HTML, and selection
events let the host application display its own content.

The focused demo selects a planet, highlights its aspect relationships and updates
an application panel. It also has a natal/transit bi-wheel with manual invented
steps: https://yuzuwoeser.github.io/astr3/examples/selection/

The rendering work includes exact longitude markers with separately packed labels,
screen-space picking, touch/keyboard selection and explicit DOM/GPU cleanup. All
positions in this demo are invented; the library can render independently supplied
data or use an optional calculation adapter.

Source: https://github.com/yuzuwoeser/astr3

I'd welcome feedback on the selection interaction and label readability, especially
on smaller screens. This post was prepared with AI assistance; the demo and source
are available to inspect.

Attach the PNG. Use the forum's Showcase category; posts require moderator approval.
Do not repost while waiting for moderation.

## Follow-up post: an implementation detail

An astrology wheel becomes easier to use when selection can drive the rest of the
page. In ASTR3, `chart.on('selection', ({ details }) => ...)` returns the selected
object and its immediate relationships. A React state setter can turn that into
an explanation panel. The effect owns both the subscription and chart cleanup.

Runnable component and tutorial:
https://yuzuwoeser.github.io/astr3/integrations/react/

## Technical answers

**Can I use my existing ephemeris?** Yes. Supply body longitudes in degrees and
optional houses/aspects through `ChartInput`. The renderer does not fetch data.
The optional adapter is separate from the rendering API. See
[the API](https://github.com/yuzuwoeser/astr3/blob/main/docs/api.md).

**Does it generate readings?** Your application supplies its own interpretation
content. ASTR3 provides selection, relationships and rendering.

**Is it a 3D chart?** The current product displays astrology wheels using Three.js.
Do not describe it as a 3D sky simulation.

**Does it work in React or an SSR application?** Imports are SSR-safe. Create the
chart after browser mounting; dispose it during cleanup. The React starter covers
selection, updates and Strict Mode. Interactive graphics need WebGL 2; an HTML
object list preserves selection when graphics are unavailable.

**Does it need a backend or an API key?** Rendering supplied data needs neither.
The optional Astronomy Engine adapter calculates locally. Your own application's
geocoding, storage and data-provider choices are separate.

**What about synastry or Vedic kundli?** The current focus is Western astrology
natal and transit wheels. Synastry is deferred. Do not promise Vedic layouts,
standalone transit houses or unimplemented calculation systems.

**Why choose it over an SVG renderer?** Evaluate the actual interaction, selection
events and host UI integration in the demo. ASTR3 uses Three.js and needs WebGL 2
for graphics. It does not claim to be smaller, faster or more accurate than other
libraries without comparative evidence.

**How stable is it?** The public API is 0.x and experimental. State this when
someone is considering production use, and ask which integration contract they
need to rely on. Calculations have documented conventions and limits in
[the calculation guide](https://github.com/yuzuwoeser/astr3/blob/main/docs/calculations.md).

## Reply patterns for interested builders

- Existing project: “What stack and calculation source are you using? If you can
  share invented sample JSON, I can map it to a minimal chart.”
- Installation trouble: “Which command failed, and what Node/browser version are
  you using? Please remove credentials and birth information from the example.”
- Feature gap: “What user action needs this, and what stops you with the current
  API? A small example will help separate a missing example from a missing feature.”
- Working integration: “Would you be comfortable sharing a public demo link, and
  may I include it in the project showcase?”

These patterns are not for communities that prohibit generated replies. There,
use the technical references to write the response yourself.
