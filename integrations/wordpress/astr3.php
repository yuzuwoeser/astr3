<?php
/**
 * Plugin Name: ASTR3
 * Description: Interactive natal and transit charts from supplied JSON data, with a block and shortcode.
 * Version: __VERSION__
 * Requires at least: 6.5
 * Requires PHP: 8.0
 * License: MIT
 * Plugin URI: https://github.com/yuzuwoeser/astr3
 * Text Domain: astr3
 */

if (!defined('ABSPATH')) {
    exit;
}

function astr3_register(): void {
    $base = plugin_dir_url(__FILE__);
    wp_register_script('astr3-editor', $base . 'editor.js', array('wp-blocks', 'wp-element', 'wp-components', 'wp-block-editor'), '__VERSION__', true);
    wp_register_style('astr3-chart', $base . 'style.css', array(), '__VERSION__');
    wp_register_script_module('astr3-view', $base . 'view.js', array(), '__VERSION__');
    register_block_type(__DIR__, array('render_callback' => 'astr3_render_chart'));
    add_shortcode('astr3_chart', 'astr3_shortcode');
}
add_action('init', 'astr3_register');

/** JSON remains data in a non-executable script. Browser model validation is authoritative. */
function astr3_render_chart(array $attributes): string {
    $kind = $attributes['kind'] ?? 'natal';
    $preset = $attributes['preset'] ?? 'midnight';
    $label = $attributes['label'] ?? 'Astrology chart';
    if (!in_array($kind, array('natal', 'transit'), true) || !is_string($label) || !is_string($attributes['dataJson'] ?? null)) {
        return '<p role="status">' . esc_html__('Invalid ASTR3 chart settings.', 'astr3') . '</p>';
    }
    if (($kind === 'natal' && !in_array($preset, array('midnight', 'paper'), true)) || ($kind === 'transit' && $preset !== 'transit')) {
        return '<p role="status">' . esc_html__('Choose an ASTR3 preset for this chart type.', 'astr3') . '</p>';
    }
    try {
        $data = json_decode($attributes['dataJson'] ?? '', false, 512, JSON_THROW_ON_ERROR);
        if (!is_object($data)) {
            throw new JsonException('Expected an object.');
        }
    } catch (JsonException $error) {
        return '<p role="status">' . esc_html__('Invalid ASTR3 chart JSON. Edit the chart block to correct it.', 'astr3') . '</p>';
    }
    $config = wp_json_encode(array('kind' => $kind, 'data' => $data, 'preset' => $preset, 'label' => $label), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
    if ($config === false) {
        return '<p role="status">' . esc_html__('Could not encode ASTR3 chart data.', 'astr3') . '</p>';
    }
    wp_enqueue_style('astr3-chart');
    wp_enqueue_script_module('astr3-view');
    return '<astr3-embed><div class="astr3-chart-host"></div><p role="status"></p><script type="application/json" class="astr3-config">' . $config . '</script></astr3-embed>';
}

/** Resolve only blocks stored directly in the current post, without rendering it recursively. */
function astr3_find_chart(array $blocks, string $id): ?array {
    foreach ($blocks as $block) {
        if (($block['blockName'] ?? '') === 'astr3/chart' && ($block['attrs']['chartId'] ?? '') === $id) {
            return $block['attrs'];
        }
        $found = astr3_find_chart($block['innerBlocks'] ?? array(), $id);
        if ($found !== null) {
            return $found;
        }
    }
    return null;
}

function astr3_shortcode($attributes): string {
    $attributes = shortcode_atts(array('id' => ''), $attributes, 'astr3_chart');
    $post = get_post();
    if (!$post || post_password_required($post)) {
        return '';
    }
    $chart = astr3_find_chart(parse_blocks($post->post_content), (string) $attributes['id']);
    if ($attributes['id'] === '' || $chart === null) {
        return '<p role="status">' . esc_html__('ASTR3 chart not found in this post. Check its Chart ID.', 'astr3') . '</p>';
    }
    return astr3_render_chart($chart);
}
