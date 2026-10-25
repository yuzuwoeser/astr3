import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  sha256,
  validateCandidate,
  verifyExisting,
  verifyNpm,
} from '../../scripts/release-policy.js';

describe('release publication guards', () => {
  const candidate = {
    tag: 'v0.1.0',
    version: '0.1.0',
    commit: 'abc',
    manifestCommit: 'abc',
    onMain: true,
  };
  it('requires matching stable versions, main ancestry, and the tested commit', () => {
    expect(() => validateCandidate(candidate)).not.toThrow();
    for (const overrides of [
      { tag: 'v0.2.0' },
      { tag: 'v0.1.0-beta.1' },
      { onMain: false },
      { manifestCommit: 'other' },
    ])
      expect(() => validateCandidate({ ...candidate, ...overrides })).toThrow();
  });
  it('allows exact reruns and rejects different release bytes', () => {
    const expected = sha256(Buffer.from('tested artifact'));
    expect(() => verifyExisting('browser.zip', expected, expected)).not.toThrow();
    expect(() => verifyExisting('browser.zip', expected, sha256(Buffer.from('other')))).toThrow(
      'Refusing to overwrite',
    );
  });
  it('compares the published npm integrity with the tested tarball', () => {
    const bytes = Buffer.from('package');
    const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
    expect(() => verifyNpm(bytes, { dist: { integrity } })).not.toThrow();
    expect(() => verifyNpm(Buffer.from('changed'), { dist: { integrity } })).toThrow();
    expect(() => verifyNpm(bytes, {})).toThrow();
  });
});
