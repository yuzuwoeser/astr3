(function () {
  const moduleUrl = new URL('./view.js', document.currentScript.src).href;
  const { createElement: h, useEffect, useRef, useState } = wp.element;
  const { TextareaControl, TextControl, SelectControl, Button, Notice } = wp.components;
  const sample = {
    bodies: [
      { id: 'sun', name: 'Sun', longitude: 0 },
      { id: 'moon', name: 'Moon', longitude: 120 },
      { id: 'jupiter', name: 'Jupiter', longitude: 240 },
    ],
  };
  const attributes = {
    chartId: { type: 'string', default: '' },
    kind: { type: 'string', default: 'natal' },
    dataJson: { type: 'string', default: '' },
    preset: { type: 'string', default: 'midnight' },
    label: { type: 'string', default: 'Astrology chart' },
  };
  function Edit({ attributes: config, setAttributes, clientId }) {
    const host = useRef();
    const chart = useRef();
    const appearanceKey = useRef();
    const [message, setMessage] = useState('');
    const [preview, setPreview] = useState(0);
    const { chartId, dataJson, kind, preset, label } = config;
    const blockProps = wp.blockEditor.useBlockProps();
    useEffect(() => {
      if (!chartId) setAttributes({ chartId: `chart-${clientId}` });
    }, [chartId, clientId]);
    useEffect(() => {
      let active = true;
      async function render() {
        try {
          const api = await import(moduleUrl);
          const data = JSON.parse(dataJson);
          api.validateData(data, kind);
          const appearance = await api.loadPreset(preset, kind);
          const library = await import(new URL('./assets/astr3.js', moduleUrl).href);
          if (!active) return;
          const nextKey = JSON.stringify([kind, preset, label]);
          if (chart.current && appearanceKey.current === nextKey) {
            chart.current.update(data);
          } else {
            // Presets apply at creation; invalid edits leave the previous preview intact.
            chart.current?.dispose();
            const create = kind === 'transit' ? library.createTransitChart : library.createChart;
            chart.current = create(host.current, { ...appearance, data, ariaLabel: label });
            appearanceKey.current = nextKey;
          }
          setMessage(chart.current.error?.message ?? 'Preview ready.');
        } catch (error) {
          if (active) setMessage(error.message);
        }
      }
      if (dataJson) render();
      else setMessage('Paste chart JSON or load the invented sample, then preview.');
      return () => {
        active = false;
      };
      // Editing fields does not rebuild the preview until Preview is pressed.
    }, [preview]);
    useEffect(
      () => () => {
        chart.current?.dispose();
      },
      [],
    );
    return h(
      'div',
      blockProps,
      h(SelectControl, {
        label: 'Chart type',
        value: kind,
        options: [
          { label: 'Natal', value: 'natal' },
          { label: 'Natal + transit', value: 'transit' },
        ],
        onChange: (value) =>
          setAttributes({ kind: value, preset: value === 'transit' ? 'transit' : 'midnight' }),
      }),
      h(TextareaControl, {
        label: 'Chart JSON',
        value: dataJson,
        rows: 10,
        onChange: (value) => setAttributes({ dataJson: value }),
        help:
          kind === 'transit'
            ? 'Supply { "natal": ChartInput, "transit": ChartInput }. This data becomes part of the published page.'
            : 'Supply ChartInput with a bodies array. This data becomes part of the published page.',
      }),
      h(SelectControl, {
        label: 'Appearance',
        value: preset,
        options:
          kind === 'transit'
            ? [{ label: 'Transit', value: 'transit' }]
            : [
                { label: 'Midnight', value: 'midnight' },
                { label: 'Paper', value: 'paper' },
              ],
        onChange: (value) => setAttributes({ preset: value }),
      }),
      h(TextControl, {
        label: 'Accessible label',
        value: label,
        onChange: (value) => setAttributes({ label: value }),
      }),
      h(TextControl, {
        label: 'Chart ID',
        value: chartId,
        onChange: (value) => setAttributes({ chartId: value }),
        help: 'Use a unique ID within this post. Shortcode: [astr3_chart id="' + chartId + '"]',
      }),
      h(
        Button,
        {
          variant: 'secondary',
          onClick: () =>
            setAttributes({
              dataJson: JSON.stringify(
                kind === 'transit' ? { natal: sample, transit: sample } : sample,
                null,
                2,
              ),
            }),
        },
        'Load invented sample',
      ),
      h(
        Button,
        { variant: 'primary', onClick: () => setPreview((value) => value + 1) },
        'Preview chart',
      ),
      message && h(Notice, { status: 'info', isDismissible: false }, message),
      h('div', { ref: host, className: 'astr3-chart-host' }),
    );
  }
  wp.blocks.registerBlockType('astr3/chart', {
    apiVersion: 3,
    title: 'ASTR3 Chart',
    category: 'widgets',
    icon: 'chart-pie',
    attributes,
    edit: Edit,
    save: () => null,
  });
})();
