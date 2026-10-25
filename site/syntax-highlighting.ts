import hljs from 'highlight.js/lib/core';
import type { LanguageFn } from 'highlight.js';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import erb from 'highlight.js/lib/languages/erb';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import php from 'highlight.js/lib/languages/php';
import phpTemplate from 'highlight.js/lib/languages/php-template';
import ruby from 'highlight.js/lib/languages/ruby';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import './syntax-highlighting.css';

// The PHP/HTML bridge must skip line comments before looking for quotes or
// closing tags. Otherwise an apostrophe in a comment consumes the template.
const phpMarkup: LanguageFn = (api) => {
  const grammar = phpTemplate(api);
  const bridge = grammar.contains?.[0];
  if (bridge && typeof bridge === 'object')
    bridge.contains = [
      { begin: /\/\//, end: /$/, skip: true },
      { begin: /#(?!\[)/, end: /$/, skip: true },
      ...(bridge.contains ?? []),
    ];
  return grammar;
};

const highlighter = hljs.newInstance();
for (const [language, grammar] of Object.entries({
  bash,
  css,
  erb,
  javascript,
  json,
  markdown,
  php,
  'php-template': phpMarkup,
  ruby,
  typescript,
  xml,
  yaml,
}))
  highlighter.registerLanguage(language, grammar);

const fileLanguages: Record<string, string> = {
  bash: 'bash',
  sh: 'bash',
  css: 'css',
  erb: 'erb',
  js: 'javascript',
  jsx: 'javascript',
  cjs: 'javascript',
  mjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  json: 'json',
  md: 'markdown',
  php: 'php-template',
  rb: 'ruby',
  html: 'xml',
  svg: 'xml',
  vue: 'xml',
  svelte: 'xml',
  xml: 'xml',
  yml: 'yaml',
  yaml: 'yaml',
};

function blockLanguage(code: HTMLElement, source: string): string | undefined {
  // Source tabs already display their canonical filenames. Read that metadata
  // so the registry and JSON template feature need no highlighting changes.
  const filename = code
    .closest('[role=tabpanel]')
    ?.querySelector('.source-heading span')?.textContent;
  if (filename) return fileLanguages[filename.trim().split('.').at(-1) ?? ''];
  const fence = [...code.classList].find((name) => name.startsWith('language-'))?.slice(9);
  if (fence) return highlighter.getLanguage(fence) ? fence : undefined;
  // The homepage also displays standalone JSON, without a Markdown fence.
  if (/^\s*[\[{]/.test(source)) {
    try {
      JSON.parse(source);
      return 'json';
    } catch {
      /* Keep unlabeled prose as plain text. */
    }
  }
  return undefined;
}

export function highlightCodeBlocks(root: ParentNode = document): void {
  for (const code of root.querySelectorAll<HTMLElement>('pre > code')) {
    if (code.dataset.syntaxHighlighted) continue;
    const source = code.textContent ?? '';
    const language = blockLanguage(code, source);
    if (!language) continue;
    // Highlight.js escapes the source before producing its token markup.
    // The original text, whitespace, and copy/paste behavior are preserved.
    code.innerHTML = highlighter.highlight(source, { language, ignoreIllegals: true }).value;
    code.classList.add('hljs');
    code.dataset.syntaxHighlighted = language;
    code.parentElement!.classList.add('syntax-highlighted');
  }
}
