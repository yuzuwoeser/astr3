## PHP templates

This recipe targets PHP 8.x and modern module-capable browsers. The preview is
the shared HTML browser example; GitHub Pages does not execute PHP. PHP syntax is
checked when PHP is installed. A complete PHP server deployment is not covered
by the browser suite.

### Setup

1. Download the website's browser bundle and extract its contents into an `astr3/`
   directory next to `chart.php`.
2. Copy `php.js` into that `astr3/` directory alongside `embed.js` and `astr3.js`.
3. Serve `chart.php` through your PHP application. Replace the synthetic fixture
   with your own validated chart input.

The template outputs a container and a non-executable JSON script block. It uses
`JSON_HEX_TAG`, `JSON_HEX_AMP`, `JSON_HEX_APOS`, and `JSON_HEX_QUOT` to encode data
safely in HTML. Keep these flags when substituting server data. Do not concatenate
user data into executable JavaScript or use `innerHTML` for labels.

### Lifecycle

A normal full-page navigation tears down the document. If your site replaces
content without navigating, retain the chart returned by `mountChart` and call
`dispose()` before removing its host. Use `update()` for data changes. The Rails
recipe demonstrates a lifecycle-aware integration for dynamic navigation.

See the [PHP JSON documentation](https://www.php.net/manual/en/function.json-encode.php)
for the encoding flags.
