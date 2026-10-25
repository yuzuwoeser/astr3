import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  root: root('./.generated/'),
  plugins: [
    {
      name: 'site-source-entries',
      transformIndexHtml: {
        order: 'pre',
        handler(html, context) {
          if (!context.server) return html;
          // Generated HTML lives below the site root; its source entry points
          // live outside that root. Use Vite's filesystem URL during development.
          return html.replace(
            /(<script type="module" src=")([^"]+)(")/g,
            (_match, before, source, after) =>
              `${before}/@fs/${resolve(dirname(context.filename), source)}${after}`,
          );
        },
      },
    },
  ],
  publicDir: root('../.site-cache/public/'),
  resolve: {
    alias: [
      {
        find: 'astr3/ephemeris',
        replacement: root('../src/ephemeris/index.ts'),
      },
      { find: 'astr3/model', replacement: root('../src/model/index.ts') },
      { find: /^astr3$/, replacement: root('../src/index.ts') },
    ],
  },
  server: { fs: { allow: [root('../')] } },
  build: { outDir: root('../site-dist/'), emptyOutDir: true },
});
