<?php
// Copy the browser download's files into ./astr3/ next to this template.
// Replace this public fixture with your own validated ChartInput data.
$chart = json_decode(file_get_contents(__DIR__ . '/astr3/chart-data.json'), true, 512, JSON_THROW_ON_ERROR);
$json = json_encode($chart, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR);
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PHP + ASTR3</title>
  <link rel="stylesheet" href="./astr3/preview.css">
</head>
<body>
  <main data-astr3>
    <h1>PHP + ASTR3</h1>
    <div class="chart-host"></div>
    <p role="status"></p>
    <script type="application/json" data-chart-input><?= $json ?></script>
  </main>
  <script type="module" src="./astr3/php.js"></script>
</body>
</html>
