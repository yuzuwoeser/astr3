// Resolve TypeScript from this workspace, independently of the core TS 7 build.
require('vue-tsc').run(require.resolve('typescript/lib/tsc'));
