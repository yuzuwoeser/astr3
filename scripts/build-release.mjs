import { cpSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  buildBrowser,
  buildStarters,
  buildWordpress,
  filesIn,
  run,
  writeJson,
  zip,
} from './distributions.mjs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const output = resolve('.release');
rmSync(output, { recursive: true, force: true });
mkdirSync(join(output, 'package'), { recursive: true });
// npm run build:release builds the library first. Never run prepack again here.
const [packed] = JSON.parse(
  run('npm', [
    'pack',
    '--offline',
    '--ignore-scripts',
    '--json',
    '--cache',
    join(output, 'npm-cache'),
    '--pack-destination',
    output,
  ]),
);
// Keep release asset URLs stable even though npm prefixes scoped tarball names.
const tarball = join(output, `astr3-${version}.tgz`);
if (join(output, packed.filename) !== tarball) renameSync(join(output, packed.filename), tarball);
run('tar', ['-xzf', tarball, '--strip-components', '1', '-C', join(output, 'package')]);
await buildBrowser(join(output, 'browser'), join(output, 'package'));
buildWordpress(join(output, 'wordpress'), join(output, 'browser'), version);
buildStarters(join(output, 'starters'), tarball, version, join(output, 'browser'));
zip(join(output, 'browser'), join(output, `astr3-browser-${version}.zip`));
zip(join(output, 'wordpress'), join(output, `astr3-wordpress-${version}.zip`));
for (const file of filesIn(join(output, 'starters')).filter(
  (file) => !file.includes('/') && file.endsWith('.zip'),
))
  cpSync(join(output, 'starters', file), join(output, file));
const artifacts = filesIn(output).filter(
  (file) => !file.includes('/') && /\.(zip|tgz)$/.test(file),
);
const manifest = {
  version,
  commit: run('git', ['rev-parse', 'HEAD']).trim(),
  artifacts: artifacts.map((name) => ({
    name,
    sha256: createHash('sha256')
      .update(readFileSync(join(output, name)))
      .digest('hex'),
  })),
};
writeJson(join(output, 'manifest.json'), manifest);
const checksums =
  [...artifacts, 'manifest.json']
    .sort()
    .map(
      (name) =>
        `${createHash('sha256')
          .update(readFileSync(join(output, name)))
          .digest('hex')}  ${name}`,
    )
    .join('\n') + '\n';
writeFileSync(join(output, 'SHA256SUMS'), checksums);
console.log(`Release ${version} built in .release/ at ${manifest.commit}. Nothing published.`);
