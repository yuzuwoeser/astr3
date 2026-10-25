## WordPress child-theme recipe

Requires WordPress 6.5+ for `wp_enqueue_script_module()` and a modern browser.
This is a developer recipe, not an installable plugin or editor block. The live
preview runs the shared HTML browser example; no WordPress instance is running
on GitHub Pages. PHP syntax is checked where available, but full WordPress theme
runtime validation is not part of the browser suite.

### Setup

1. Download the browser bundle into your child theme's `astr3/` directory.
2. Copy `wordpress.js` into that directory, beside `embed.js` and `astr3.js`.
3. Add the asset-registration code from `functions.php` to your child theme.
4. Add `page-chart.php` to that theme and assign its **ASTR3 chart** template to a
   page in WordPress.

The assets load only on pages using the chart template. Replace the public
synthetic JSON fixture with validated data from your application. Version asset
URLs when updating the bundle. Keep the JSON encoding flags in the template;
do not insert unescaped values into scripts.

### Scope and lifecycle

This example covers standard WordPress page navigation. Themes with AJAX page
replacement need their own cleanup hook: retain each chart instance and dispose
it before removing the host. Editor previews, shortcodes, blocks, configuration
storage, and WordPress.com plan-specific restrictions are outside this recipe.

Follow the official [WordPress asset-loading guidance](https://developer.wordpress.org/plugins/javascript/enqueuing/)
and [script module API](https://developer.wordpress.org/reference/functions/wp_enqueue_script_module/).
