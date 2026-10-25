# ASTR3 examples

This directory is the source of truth for the website's runnable examples,
framework adapters, source tabs, and integration instructions. `site/` owns the
website shell; the core library stays in `src/`.

## Run an example

Use Node.js 24 LTS. From the repository root:

```sh
npm ci
npm run dev
```

Open the printed URL. Use **Integrations** or visit `/previews/vue/`, for example.
The complete explorer lives at `/playground/`. `dev` builds all previews first;
restart it after editing an example to rebuild those previews. Website styles/scripts and playground changes are served through Vite during
development, including library source updates. Restart after changing the
registry or a guide to regenerate its page.

```sh
npm run build:site
npm run typecheck:examples
npm run test:pages
```

The build compiles all browser applications against an extracted local npm
package, not aliases into the library source. Root npm workspaces lock framework
dependencies while each framework keeps its own compiler configuration. The
Angular and Svelte/Vue tooling use TypeScript 6 separately from the library's
TypeScript 7.

## Use code in another application

ASTR3 has not yet been published to npm. Run `npm pack` at the repository root,
then install the generated tarball and `three` in your application. The
`file:../..` dependency in example workspace manifests is for this checkout;
replace it with your tarball path when copying an example. Install
`astronomy-engine` only if you use `astr3/ephemeris`.

The HTML download already bundles dependencies and can be self-hosted without
npm. Serve modules over HTTP/HTTPS; browsers do not support this example through
`file://`. Its optional ephemeris module and lazy export chunks must remain next
to the other downloaded files.

## Add an example

1. Create a folder containing its source and `README.md`. Use invented positions
   or documented public reference data, never personal birth data.
2. Add an entry to `registry.mjs`: stable identifier, title, category, description,
   preview path, build kind, and all source files needed to understand/run the example.
3. For a new compiled application, add its workspace and select an existing
   registry build kind (`vite`, `vue`, `svelte`, `angular`, or `rails`). Add compiler
   support in `scripts/build-site.mjs` only for a new toolchain. Backend recipes can reuse the HTML preview
   with `browserOnly: true`.
4. Add browser coverage for the example's behavior. The website's gallery, detail
   page, source tabs, and setup instructions are generated from the registry and
   source files; do not copy snippets into `site/`.

Current backend guides are developer recipes, not installable CMS packages.
Their preview labels state where full backend runtime testing is absent.
