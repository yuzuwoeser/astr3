import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Only remove this package's generated output; never touch application/source files.
rmSync(new URL('../dist/', import.meta.url), { recursive: true, force: true });
const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url)),
    '-p',
    'tsconfig.build.json',
  ],
  { stdio: 'inherit', cwd: fileURLToPath(new URL('..', import.meta.url)) },
);
process.exit(result.status ?? 1);
