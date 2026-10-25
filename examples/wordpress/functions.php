<?php
// Add to a child theme's functions.php. Requires WordPress 6.5+ script modules.
add_action('wp_enqueue_scripts', function () {
    if (!is_page_template('page-chart.php')) {
        return;
    }
    $base = get_stylesheet_directory_uri() . '/astr3/';
    wp_enqueue_script_module('astr3-chart', $base . 'wordpress.js', array(), '0.1.1');
    wp_enqueue_style('astr3-preview', $base . 'preview.css', array(), '0.1.1');
});
