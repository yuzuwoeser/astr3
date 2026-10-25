=== ASTR3 ===
Requires at least: 6.5
Requires PHP: 8.0
Stable tag: __VERSION__
License: MIT

Interactive natal and transit charts from supplied JSON data.

== Installation ==
Upload astr3-wordpress-__VERSION__.zip under Plugins > Add New > Upload Plugin.
Activate ASTR3. In a page or post, insert the ASTR3 Chart block, paste ChartInput
JSON, choose a preset, set an accessible label, and click Preview chart.
Publish the page to display the chart. Chart data is public page content.

For transit mode use { "natal": ChartInput, "transit": ChartInput }.
Load invented sample provides safe teaching positions for either mode.

The compatibility shortcode [astr3_chart id="my-chart"] displays a chart block
with that Chart ID from the current post. Use unique Chart IDs. The block itself
also renders. Cross-post references and reusable/synced block lookup are excluded.

No birth-detail entry, geocoding, remote data sources, or external services.
All assets and presets are bundled. No theme edits or npm installation required.
An accessible object list remains usable when WebGL is unavailable.

== Updates ==
Install a newer release ZIP using WordPress's plugin replacement flow.
No automatic updater or WordPress.org directory publication is included.

Source, documentation and licenses: https://github.com/yuzuwoeser/astr3
Third-party notices and font licenses are included under assets/.
