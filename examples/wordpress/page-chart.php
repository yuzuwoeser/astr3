<?php
/* Template Name: ASTR3 chart */
get_header();
// A public synthetic fixture, independent of user information.
$chart = json_decode(file_get_contents(get_stylesheet_directory() . '/astr3/chart-data.json'), true);
$json = wp_json_encode($chart, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
?>
<main data-astr3>
  <h1><?php echo esc_html(get_the_title()); ?></h1>
  <div class="chart-host"></div>
  <p role="status"></p>
  <script type="application/json" data-chart-input><?php echo $json; // Safely JSON-encoded above; do not HTML-escape JSON. ?></script>
</main>
<?php get_footer(); ?>
