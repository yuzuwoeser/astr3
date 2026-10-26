import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { marked } from 'marked';
import { examples } from '../examples/registry.mjs';

export const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
const repository = 'https://github.com/yuzuwoeser/astr3';
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

function installationChooser(base) {
  return `<section class="section" aria-labelledby="install-title"><h2 id="install-title">Choose how to install</h2><div class="cards"><article class="card"><h3>npm application</h3><p>Install <code>@yuzuwoeser/astr3</code> from npm, or use a prebuilt tarball.</p><a class="button" href="${base}downloads/astr3-${version}.tgz" download>Download npm package ${version} ↓</a></article><article class="card"><h3>Plain website</h3><p>Extract the browser bundle and serve minimal.html. No build tools required.</p><a class="button" href="${base}downloads/astr3-browser-${version}.zip" download>Download browser ${version} ↓</a></article><article class="card"><h3>WordPress</h3><p>Upload the plugin ZIP, activate ASTR3, and add a chart block with supplied JSON.</p><a class="button" href="${base}downloads/astr3-wordpress-${version}.zip" download>Download WordPress ${version} ↓</a></article></div><p><a href="${repository}/releases">Versioned releases and checksums ↗</a></p></section>`;
}
const wordmark =
  '<span class="wordmark-a">A</span><span class="wordmark-s">S</span><span class="wordmark-t">T</span><span class="wordmark-r">R</span><span class="wordmark-3">3</span>';
export const detailPath = (example) =>
  `${example.category === 'example' ? 'examples' : 'integrations'}/${example.id}/`;

function selectionDemo() {
  return `<div class="selection-demo" data-selection-demo><div class="selection-wheel" data-selection-wheel></div><div class="selection-controls" aria-label="Demo controls"><button class="button" type="button" data-select-body="sun">Select Sun</button><button class="button" type="button" data-select-body="moon">Select Moon</button><button class="button" type="button" data-next-transit>Next transit step →</button></div><p class="selection-step" data-selection-step>Invented transit step 0</p><div class="selection-details" aria-live="polite"><p class="eyebrow">YOUR APPLICATION’S PANEL</p><h3 data-selection-title>Choose a planet or aspect</h3><p data-selection-description>Select a planet to connect the chart to your own content.</p><ul data-selection-relationships></ul></div><p class="selection-status" role="status" data-selection-status></p><noscript><p>Enable JavaScript to try the interactive chart. <a href="https://github.com/yuzuwoeser/astr3#use-the-library">See a first-chart example.</a></p></noscript></div>`;
}

function templateShowcase(base) {
  const midnight = readFileSync('examples/json-templates/midnight.json', 'utf8');
  return `<section class="section template-showcase" data-template-showcase aria-labelledby="templates-title"><p class="eyebrow">YOUR PALETTE. YOUR PERSPECTIVE.</p><h2 id="templates-title">Make the chart yours</h2><p class="section-copy">Save your colors, layout, and details in a reusable JSON template. The same sky can feel right at home in your application.</p><div class="template-grid">${[
    ['midnight', 'Midnight', 'Alternative layout · regular weight'],
    ['paper', 'Paper', 'Default layout · bold weight'],
  ]
    .map(
      ([id, name, caption]) =>
        `<figure class="template-card"><figcaption><h3>${name}</h3><p>${caption}</p></figcaption><div data-template-preview="${id}"></div></figure>`,
    )
    .join(
      '',
    )}</div><div class="template-details"><div><h3>One preset, a look of your own.</h3><p>Start with a template, bring your own chart data, and adjust what you need. Use presets for natal and transit charts.</p><a class="button primary" href="${base}examples/json-templates/">Explore JSON templates →</a><p class="hero-note">Same invented positions in both previews.</p></div><pre aria-label="Midnight JSON template"><code>${escapeHtml(midnight)}</code></pre></div></section>`;
}

export function generatePages(base) {
  const inputs = {};
  function layout(title, description, body, active = '') {
    return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#111c20"><meta name="description" content="${escapeHtml(description)}"><title>${escapeHtml(title)} — ASTR3</title><link rel="preload" href="${base}fonts/Righteous-Regular.ttf" as="font" type="font/ttf" crossorigin></head><body class="project-site"><a class="skip-link" href="#main">Skip to content</a><header class="site-header"><a class="wordmark" href="${base}" aria-label="ASTR3 home">${wordmark}</a><nav aria-label="Main navigation">${[
      ['playground/', 'Playground'],
      ['examples/', 'Examples'],
      ['integrations/', 'Integrations'],
    ]
      .map(
        ([path, text]) =>
          `<a href="${base}${path}"${active === text ? ' aria-current="page"' : ''}>${text}</a>`,
      )
      .join(
        '',
      )}<a href="${repository}/blob/main/docs/api.md">Docs ↗</a><a href="${repository}">GitHub ↗</a></nav></header><main id="main">${body}</main><footer class="site-footer"><a class="wordmark" href="${base}" aria-label="ASTR3 home">${wordmark}</a><p>The sky, connected. Open source, built for the browser.</p><a href="${base}THIRD_PARTY_LICENSES.txt">Third-party licenses</a><a href="${repository}/blob/main/LICENSE">MIT license</a></footer><script type="module" src="__SITE_MAIN__"></script></body></html>`;
  }
  function write(path, html) {
    const filename = resolve('site/.generated', path, 'index.html');
    mkdirSync(dirname(filename), { recursive: true });
    const mainPath = relative(dirname(filename), resolve('site/main.ts')).split('\\').join('/');
    writeFileSync(filename, html.replace('__SITE_MAIN__', mainPath));
    inputs[path || 'home'] = filename;
  }
  function cards(entries) {
    return `<div class="cards">${entries.map((example) => `<a class="card" href="${base}${detailPath(example)}"><span class="card-kicker">${example.category === 'framework' ? 'Frontend framework' : example.category === 'server' ? 'Server-rendered websites' : 'Browser example'}</span><h3>${escapeHtml(example.title)} <span aria-hidden="true">↗</span></h3><p>${escapeHtml(example.description)}</p></a>`).join('')}</div>`;
  }
  function preview(example) {
    return `<section class="preview" aria-labelledby="preview-title"><div class="section-top"><h2 id="preview-title">${example.browserOnly ? 'Browser preview' : 'Live example'}</h2><a href="${base}${example.preview}" target="_blank" rel="noreferrer">Open separately ↗</a></div>${example.browserOnly ? '<p class="notice">This preview runs the browser integration. PHP, WordPress, and Rails servers do not run on GitHub Pages. See the setup instructions for runtime validation limits.</p>' : ''}<button class="button" type="button" data-preview="${base}${example.preview}" data-title="${escapeHtml(example.title)} live preview">Load live preview</button><div class="preview-frame"></div></section>`;
  }
  write(
    '',
    layout(
      'Interactive astrology charts for your app',
      'ASTR3 is an open source astrology chart library for JavaScript and TypeScript. Explore the playground and integrate it with your website.',
      `<section class="hero"><div><p class="eyebrow">AN OPEN SOURCE SKY</p><h1>Interactive astrology charts for your app.</h1><p class="lead">Select a planet, highlight its connections, and bring the chart into your own explanations, tables, and tools.</p><div class="hero-actions"><a class="button primary" href="${base}playground/">Try the playground ↗</a><a class="button" href="${base}integrations/typescript/">Build your first chart →</a></div><p class="hero-note">TypeScript · Three.js · MIT licensed</p></div>${selectionDemo()}</section><section class="section"><p class="eyebrow">ONE LIBRARY, MANY WAYS IN</p><h2>Start where you build.</h2><p class="section-copy">Use a frontend framework, add a chart to a server-rendered page, or start with a single HTML file.</p>${cards(examples.filter((example) => ['react', 'vue', 'svelte', 'angular'].includes(example.id)))}<a class="text-link" href="${base}integrations/">Browse all integrations, including PHP, WordPress, and Rails →</a></section><section class="feature-strip"><div><h2>Explore, then make it yours.</h2><p>Natal and transit wheels, accessible selection, local calculations, three layouts, and SVG/PNG downloads.</p></div><a class="button" href="${base}playground/">Open the playground →</a></section>${templateShowcase(base)}<section class="section"><p class="eyebrow">REAL CODE YOU CAN RUN</p><h2>From a first chart to a full explorer.</h2><p class="section-copy">Every preview is built from the source shown beside it. Start small, then explore the complete playground.</p>${cards(examples.filter((example) => ['html', 'javascript', 'typescript', 'playground'].includes(example.id)))}</section><section class="download-callout"><h2>Working without a build pipeline?</h2><p>Download self-hostable browser modules, an HTML example, and an optional calculation adapter. No CDN required.</p><a class="button primary" href="${base}downloads/astr3-browser.zip" download>Download browser bundle ↓</a><a class="text-link" href="${base}integrations/html/">Read the HTML guide →</a></section>`,
    ),
  );
  write(
    'examples/selection',
    layout(
      'Select a planet. Follow its connections.',
      'Try ASTR3 selection events, relationship highlighting, and invented transit steps in a small interactive demo.',
      `<section class="page-intro"><p class="eyebrow">INTERACTIVE ASTROLOGY · OPEN SOURCE</p><h1>Select a planet.<br>Follow its connections.</h1><p class="lead">A chart on one side. Your application’s explanation on the other. Click the wheel or try the buttons.</p></section><section class="selection-feature">${selectionDemo()}</section><p class="hero-note">All positions and transit steps are invented teaching data. Steps are not dates or calculated planetary motion.</p><section class="section"><h2>Build this interaction in your app</h2><p>Subscribe to <code>chart.on('selection', ...)</code> and use the returned objects and relationships in your own panel. Natal/transit selections include their chart source.</p><a class="button primary" href="${base}integrations/react/">Build a clickable chart in React →</a><a class="text-link" href="${base}integrations/typescript/">Start with TypeScript →</a><a class="text-link" href="${base}playground/">Open the full playground →</a></section>`,
      'Examples',
    ),
  );
  write(
    'examples',
    layout(
      'Examples',
      'Runnable ASTR3 examples with live previews and their actual source.',
      `<section class="page-intro"><p class="eyebrow">LEARN BY EXPLORING</p><h1>Examples</h1><p class="lead">Start with a small chart or explore everything the playground can do.</p><a class="button primary" href="${base}examples/selection/">Try selection and transit steps →</a></section>${cards(examples.filter((example) => ['example', 'browser'].includes(example.category)))}<section class="section"><h2>Using a framework or an existing website?</h2><p>Find lifecycle-aware examples for React, Vue.js, Svelte, Angular, PHP, WordPress, and Ruby on Rails.</p><a class="button" href="${base}integrations/">Browse integrations →</a></section>`,
      'Examples',
    ),
  );
  write(
    'integrations',
    layout(
      'Integrations',
      'Integrate ASTR3 with JavaScript, TypeScript, React, Vue.js, Svelte, Angular, PHP, WordPress, and Ruby on Rails.',
      `<section class="page-intro"><p class="eyebrow">BUILD WITH ASTR3</p><h1>A chart for your stack.</h1><p class="lead">Mount after the page exists, update when data changes, and dispose when it leaves. Choose an example for your application.</p></section>${installationChooser(base)}<section class="section"><h2>JavaScript, TypeScript &amp; HTML</h2>${cards(examples.filter((example) => example.category === 'browser'))}</section><section class="section"><h2>Frontend frameworks</h2>${cards(examples.filter((example) => example.category === 'framework'))}</section><section class="section"><h2>Server-rendered websites &amp; WordPress</h2><p class="section-copy">Your server supplies chart data as JSON. ASTR3 renders it in the visitor’s browser.</p>${cards(examples.filter((example) => example.category === 'server'))}</section>`,
      'Integrations',
    ),
  );
  for (const example of examples) {
    const sources = example.files
      .map(
        (file, index) =>
          `<section id="source-${index}" role="tabpanel" aria-labelledby="tab-${index}" tabindex="0"${index ? ' hidden' : ''}><div class="source-heading"><span>${escapeHtml(file)}</span><a href="${repository}/blob/main/examples/${file}">View on GitHub ↗</a></div><pre><code>${escapeHtml(readFileSync(resolve('examples', file), 'utf8'))}</code></pre></section>`,
      )
      .join('');
    const readme = readFileSync(resolve('examples', example.id, 'README.md'), 'utf8');
    write(
      detailPath(example),
      layout(
        example.title,
        example.description,
        `<section class="page-intro"><a class="breadcrumb" href="${base}${example.category === 'example' ? 'examples' : 'integrations'}/">← ${example.category === 'example' ? 'Examples' : 'Integrations'}</a><p class="eyebrow">${example.category === 'framework' ? 'FRONTEND FRAMEWORK' : example.category === 'server' ? 'SERVER-RENDERED WEBSITE' : 'RUNNABLE EXAMPLE'}</p><h1>${escapeHtml(example.title)}</h1><p class="lead">${escapeHtml(example.description)}</p></section>${example.category !== 'example' ? `<p><a class="button primary" href="${base}downloads/astr3-${example.id === 'html' ? 'browser' : example.id}-${version}.zip" download>Download ${escapeHtml(example.title)} ${example.id === 'wordpress' ? 'plugin' : 'starter'} ZIP ↓</a></p>` : ''}${example.downloads?.length ? `<section class="template-downloads" aria-label="JSON template downloads"><h2>Download a template</h2>${example.downloads.map((file) => `<a class="button" href="${base}${example.preview}${file.split('/').at(-1)}" download>Download ${escapeHtml(file.split('/').at(-1))} ↓</a>`).join('')}</section>` : ''}<section class="guide prose" aria-label="Setup instructions">${marked.parse(readme)}</section>${preview(example)}<section class="source-viewer" aria-labelledby="source-title"><h2 id="source-title">Source</h2><p>These are the files used by this example. Shared data and styles are included where used.</p><div class="source-tabs" role="tablist" aria-label="Source files">${example.files.map((file, index) => `<button role="tab" id="tab-${index}" aria-controls="source-${index}" aria-selected="${index === 0}" tabindex="${index ? '-1' : '0'}">${escapeHtml(file)}</button>`).join('')}</div>${sources}</section><section class="reference-links"><h2>Keep building</h2><a href="${repository}/blob/main/docs/api.md">API and data contracts ↗</a><a href="${repository}/blob/main/docs/transits.md">Transit charts ↗</a><a href="${repository}/blob/main/docs/calculations.md">Calculation conventions ↗</a></section>`,
        example.category === 'example' ? 'Examples' : 'Integrations',
      ),
    );
  }
  let playground = readFileSync('examples/playground/index.html', 'utf8');
  playground = playground
    .replace('href="./" aria-label="ASTR3 home"', `href="${base}" aria-label="ASTR3 home"`)
    .replace('href="./THIRD_PARTY_LICENSES.txt"', `href="${base}THIRD_PARTY_LICENSES.txt"`)
    .replace('src="./main.ts"', 'src="../../../examples/playground/main.ts"');
  playground = playground.replace(
    '<main>',
    `<nav class="playground-nav" aria-label="Main navigation"><a href="${base}">Home</a><a href="${base}examples/">Examples</a><a href="${base}integrations/">Integrations</a><a href="${repository}/blob/main/docs/api.md">Documentation ↗</a></nav><main>`,
  );
  write('playground', playground);
  writeFileSync('site/.generated/library.ts', "export * from '../library.js';\n");
  return inputs;
}
