import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findDependencyLicense } from '../../scripts/dependency-license.js';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function fixture(filename?: string) {
  const directory = mkdtempSync(join(tmpdir(), 'astr3-license-'));
  directories.push(directory);
  if (filename) writeFileSync(join(directory, filename), 'Dependency license');
  return directory;
}

describe('website dependency notices', () => {
  it('preserves the lowercase filename shipped by clsx on case-sensitive hosts', () => {
    const directory = fixture('license');
    // Exact path comparison catches the Linux regression even on macOS.
    expect(findDependencyLicense(directory)).toBe(join(directory, 'license'));
  });
  it('reads the actual casing of other supported license filenames', () => {
    const directory = fixture('LiCeNsE.Md');
    expect(findDependencyLicense(directory)).toBe(join(directory, 'LiCeNsE.Md'));
  });
  it('leaves a missing license detectable by the build guard', () => {
    expect(findDependencyLicense(fixture())).toBeUndefined();
  });
});
