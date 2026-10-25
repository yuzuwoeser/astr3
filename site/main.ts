import './style.css';

if (document.querySelector('[data-selection-demo]'))
  void import('./selection-demo.js').then(({ startSelectionDemos }) => startSelectionDemos());

if (document.querySelector('[data-template-showcase]'))
  void import('./template-previews.js').then(({ startTemplatePreviews }) =>
    startTemplatePreviews(),
  );

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-preview]')) {
  button.addEventListener(
    'click',
    () => {
      const frame = document.createElement('iframe');
      frame.src = button.dataset.preview!;
      frame.title = button.dataset.title!;
      frame.loading = 'lazy';
      button.closest('.preview')!.querySelector('.preview-frame')!.replaceChildren(frame);
      button.hidden = true;
    },
    { once: true },
  );
}
for (const list of document.querySelectorAll<HTMLElement>('[role=tablist]')) {
  const tabs = [...list.querySelectorAll<HTMLButtonElement>('[role=tab]')];
  function activate(tab: HTMLButtonElement) {
    for (const candidate of tabs) {
      const selected = candidate === tab;
      candidate.setAttribute('aria-selected', String(selected));
      candidate.tabIndex = selected ? 0 : -1;
      document.getElementById(candidate.getAttribute('aria-controls')!)!.hidden = !selected;
    }
  }
  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', (event) => {
      let next: number;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      activate(tabs[next]!);
      tabs[next]!.focus();
    });
  }
}

// Source stays readable without JavaScript; load tokenizers only on code pages.
if (document.querySelector('pre > code'))
  void import('./syntax-highlighting.js').then(({ highlightCodeBlocks }) => highlightCodeBlocks());
