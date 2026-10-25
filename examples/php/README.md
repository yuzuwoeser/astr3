## PHP templates

This recipe targets PHP 8.x and modern module-capable browsers. The preview is
the shared HTML browser example; GitHub Pages does not execute PHP. PHP syntax is
checked when PHP is installed. A complete PHP server deployment is not covered
by the browser suite.

### Install

Download this page’s **starter ZIP** and extract it into your PHP application.
It includes `chart.php` and an `astr3/` directory with browser modules and `php.js`.
Serve `chart.php` through PHP 8.x; no npm or repository checkout is needed.

### Minimal integration

The template and browser entry shown below are the required files. Replace the
invented `astr3/chart-data.json` with validated chart data. The demo stylesheet
is optional; keep a nonzero host width.

The template outputs a container and a non-executable JSON script block. It uses
`JSON_HEX_TAG`, `JSON_HEX_AMP`, `JSON_HEX_APOS`, and `JSON_HEX_QUOT` to encode data
safely in HTML. Keep these flags when substituting server data. Do not concatenate
user data into executable JavaScript or use `innerHTML` for labels.

### Update and cleanup

A normal full-page navigation tears down the document. If your site replaces
content without navigating, retain the chart returned by `mountChart` and call
`dispose()` before removing its host. Use `update()` for data changes. The Rails
recipe demonstrates a lifecycle-aware integration for dynamic navigation.

See the [PHP JSON documentation](https://www.php.net/manual/en/function.json-encode.php)
for the encoding flags.

For reusable appearance, keep chart data separate from a JSON template and call
`resolveChartTemplate` before mounting. The
[PHP-to-JSON template guide](https://github.com/yuzuwoeser/astr3/blob/main/docs/integrations.md#json-appearance-presets)
shows safe encoding and browser resolution; the
[JSON templates example](https://yuzuwoeser.github.io/astr3/examples/json-templates/)
provides downloadable natal and transit presets.
