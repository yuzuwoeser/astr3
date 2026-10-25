import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { run } from './process.mjs';
import {
  sha256,
  validateCandidate,
  verifyExisting,
  verifyNpm,
  waitForNpmPublication,
} from './release-policy.ts';

const { version, name } = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('.release/manifest.json', 'utf8'));
const tag = process.env.GITHUB_REF_NAME ?? '';
const commit = run('git', ['rev-parse', 'HEAD']).trim();
if (run('git', ['status', '--porcelain']).trim())
  throw new Error('Release publication requires a clean checkout.');
validateCandidate({
  tag,
  version,
  commit,
  manifestCommit: manifest.commit,
  onMain: spawnSync('git', ['merge-base', '--is-ancestor', commit, 'origin/main']).status === 0,
});
if (manifest.version !== version) throw new Error('Manifest version mismatch.');
if (process.env.GITHUB_REPOSITORY !== 'yuzuwoeser/astr3')
  throw new Error('Release workflow is restricted to yuzuwoeser/astr3.');
const files = [...manifest.artifacts.map((entry) => entry.name), 'manifest.json', 'SHA256SUMS'];
for (const { name: file, sha256: digest } of manifest.artifacts)
  verifyExisting(file, digest, sha256(readFileSync(join('.release', file))));
const sums = readFileSync('.release/SHA256SUMS', 'utf8');
const expectedSums =
  files
    .filter((file) => file !== 'SHA256SUMS')
    .sort()
    .map((file) => `${sha256(readFileSync(join('.release', file)))}  ${file}`)
    .join('\n') + '\n';
verifyExisting('SHA256SUMS', expectedSums, sums);

// Read-only preflight distinguishes a missing resource from authentication/network failures.
const releases = JSON.parse(
  run('gh', [
    'api',
    '--paginate',
    '--slurp',
    `repos/${process.env.GITHUB_REPOSITORY}/releases?per_page=100`,
  ]),
).flat();
const existing = releases.find((release) => release.tag_name === tag);
const scratch = mkdtempSync(join(tmpdir(), 'astr3-release-'));
try {
  if (existing) {
    if (existing.target_commitish !== commit && existing.target_commitish !== tag)
      throw new Error('Existing release targets a different commit.');
    for (const asset of existing.assets) {
      if (!files.includes(asset.name)) throw new Error(`Unexpected release asset: ${asset.name}`);
      run('gh', ['release', 'download', tag, '--pattern', asset.name, '--dir', scratch]);
      verifyExisting(
        asset.name,
        sha256(readFileSync(join('.release', asset.name))),
        sha256(readFileSync(join(scratch, asset.name))),
      );
    }
  }
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`);
  const published = response.ok;
  if (published) verifyNpm(readFileSync(`.release/astr3-${version}.tgz`), await response.json());
  else if (response.status !== 404) throw new Error(`npm preflight failed: ${response.status}`);
  if (process.argv.includes('--dry-run')) {
    console.log(
      `Verified ${tag}; ${published ? 'npm already matches' : 'npm publication pending'}. Nothing published.`,
    );
  } else {
    if (!existing)
      run('gh', [
        'release',
        'create',
        tag,
        '--draft',
        '--target',
        commit,
        '--title',
        `ASTR3 ${version}`,
        '--notes-file',
        'docs/release-notes.md',
      ]);
    const present = new Set(existing?.assets.map((asset) => asset.name) ?? []);
    for (const file of files.filter((file) => !present.has(file)))
      run('gh', ['release', 'upload', tag, join('.release', file)]);
    if (!published)
      run('npm', [
        'publish',
        `.release/astr3-${version}.tgz`,
        '--ignore-scripts',
        '--access',
        'public',
      ]);
    await waitForNpmPublication(name, version, readFileSync(`.release/astr3-${version}.tgz`));
    run('gh', ['release', 'edit', tag, '--draft=false']);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
