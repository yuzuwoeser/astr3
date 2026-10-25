import { serveDirectory } from './static-server.mjs';
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve('.release');
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const extracted = resolve(root, 'extracted-browser');
rmSync(extracted, { recursive: true, force: true });
mkdirSync(extracted, { recursive: true });
const unzip = spawnSync('unzip', [
  '-q',
  resolve(root, `astr3-browser-${version}.zip`),
  '-d',
  extracted,
]);
if (unzip.status !== 0) throw new Error('Could not extract the browser release ZIP.');
serveDirectory(root, 4175);
