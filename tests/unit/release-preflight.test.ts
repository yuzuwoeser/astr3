import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sha256 } from '../../scripts/release-policy.js';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function fixture({ existing = false, changedAsset = false, changedNpm = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'astr3-preflight-'));
  directories.push(directory);
  mkdirSync(join(directory, '.release'));
  mkdirSync(join(directory, 'bin'));
  const artifact = 'astr3-0.1.0.tgz';
  writeFileSync(
    join(directory, 'package.json'),
    JSON.stringify({ name: '@yuzuwoeser/astr3', version: '0.1.0' }),
  );
  writeFileSync(join(directory, '.release', artifact), 'tested tarball bytes');
  writeFileSync(
    join(directory, '.release/manifest.json'),
    JSON.stringify({
      version: '0.1.0',
      commit: 'abc',
      artifacts: [{ name: artifact, sha256: sha256(Buffer.from('tested tarball bytes')) }],
    }),
  );
  const sums =
    [artifact, 'manifest.json']
      .sort()
      .map((name) => `${sha256(readFileSync(join(directory, '.release', name)))}  ${name}`)
      .join('\n') + '\n';
  writeFileSync(join(directory, '.release/SHA256SUMS'), sums);
  // Stub the external boundaries. Any command that could publish records a failure.
  const stub = `#!/usr/bin/env node
import { basename, join } from 'node:path';
import { copyFileSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
if (basename(process.argv[1]) === 'git') {
  if (args[0] === 'rev-parse') console.log('abc');
  else if (!['status', 'merge-base'].includes(args[0])) process.exit(1);
} else if (basename(process.argv[1]) === 'gh' && args[0] === 'api') {
  console.log(JSON.stringify([${existing ? `[{ tag_name: 'v0.1.0', target_commitish: 'abc', assets: [{name: '${artifact}'}] }]` : '[]'}]));
} else if (basename(process.argv[1]) === 'gh' && args[0] === 'release' && args[1] === 'download') {
  const destination = join(args[args.indexOf('--dir') + 1], '${artifact}');
  ${changedAsset ? "writeFileSync(destination, 'different bytes');" : `copyFileSync(join(process.cwd(), '.release/${artifact}'), destination);`}
} else {
  writeFileSync('attempted-publication', JSON.stringify(args));
  process.exit(1);
}
`;
  for (const command of ['git', 'gh', 'npm'])
    writeFileSync(join(directory, 'bin', command), stub, { mode: 0o755 });
  writeFileSync(
    join(directory, 'fetch.mjs'),
    "import assert from 'node:assert/strict';\nglobalThis.fetch = async (url) => {\nassert.equal(url, 'https://registry.npmjs.org/%40yuzuwoeser%2Fastr3/0.1.0');\nreturn " +
      (changedNpm
        ? "new Response(JSON.stringify({dist: {integrity: 'different'}}), {status: 200});\n"
        : "new Response('{}', {status: 404});\n") +
      '};\n',
  );
  const run = (dryRun: boolean) =>
    spawnSync(
      process.execPath,
      [
        '--import',
        join(directory, 'fetch.mjs'),
        fileURLToPath(new URL('../../scripts/publish-release.mjs', import.meta.url)),
        ...(dryRun ? ['--dry-run'] : []),
      ],
      {
        cwd: directory,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${join(directory, 'bin')}${delimiter}${process.env.PATH}`,
          GITHUB_REF_NAME: 'v0.1.0',
          GITHUB_REPOSITORY: 'yuzuwoeser/astr3',
        },
      },
    );
  return { run, attemptedPublication: () => existsSync(join(directory, 'attempted-publication')) };
}

describe('publication preflight without remote writes', () => {
  it('dry-runs a new version without creating a release or publishing npm', () => {
    const check = fixture();
    const result = check.run(true);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('Nothing published.');
    expect(check.attemptedPublication()).toBe(false);
  });
  it('accepts matching assets from a partial release in a dry run', () => {
    const check = fixture({ existing: true });
    const result = check.run(true);
    expect(result.status, result.stderr).toBe(0);
    expect(check.attemptedPublication()).toBe(false);
  });
  it('rejects changed release bytes before any upload or npm publication', () => {
    const check = fixture({ existing: true, changedAsset: true });
    const result = check.run(false);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Refusing to overwrite');
    expect(check.attemptedPublication()).toBe(false);
  });
  it('rejects a different published npm tarball before creating a release', () => {
    const check = fixture({ changedNpm: true });
    const result = check.run(false);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Published npm tarball differs');
    expect(check.attemptedPublication()).toBe(false);
  });
});
