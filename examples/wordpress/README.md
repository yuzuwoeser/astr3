## WordPress integration

### Install

Download this page’s **plugin ZIP**. In WordPress, open **Plugins → Add New →
Upload Plugin**, choose the ZIP, install it, and activate **ASTR3**. Requires
WordPress 6.5+ and PHP 8+. No child-theme changes or npm installation are needed.
Use the replacement flow with a newer ZIP to update; automatic updates and a
WordPress.org directory listing are not included.

### Minimal integration

1. Insert an **ASTR3 Chart** block in a page or post.
2. Paste `ChartInput` JSON, or choose **Load invented sample**.
3. Choose natal or natal + transit, an appearance preset, and an accessible label.
4. Click **Preview chart**, then save/publish.

Transit mode expects `{ "natal": ChartInput, "transit": ChartInput }`. Invalid
JSON or model data shows a validation message. Data is stored in the block’s
post content and is included in the published page.

The shortcode `[astr3_chart id="my-chart"]` renders a chart block with that
**Chart ID** in the same post. Use unique IDs. The original block also renders.
Cross-post references and lookup inside synced/reusable blocks are excluded.

### Update and cleanup

Edit the block’s JSON/settings, preview, and save. Frontend charts use bundled
assets and presets, load only where needed, and dispose when their element is
removed. An accessible object list remains usable if WebGL is unavailable.

### Full example and validation

The source tabs below preserve the developer child-theme recipe as an optional
alternative. Those files are not required by the plugin. The live preview runs
only the browser integration; GitHub Pages cannot execute WordPress.
Plugin source lives in [integrations/wordpress](https://github.com/yuzuwoeser/astr3/tree/main/integrations/wordpress).
`npm run test:wordpress` installs the generated ZIP into real WordPress through
WordPress Playground and tests editor/save/reload and frontend behavior.
Birth-detail forms, location lookup, external JSON URLs, and a chart library are
outside this first plugin.
