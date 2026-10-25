import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { waitForNpmPublication } from '../../scripts/release-policy.js';

const bytes = Buffer.from('tested release tarball');
const metadata = {
  name: '@yuzuwoeser/astr3',
  version: '0.1.1',
  dist: { integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}` },
};
function fixture(responses: (Response | Error)[]) {
  let clock = 0;
  const fetchMetadata = vi.fn<typeof fetch>(async () => {
    const next = responses.shift() ?? new Response('{}', { status: 404 });
    if (next instanceof Error) throw next;
    return next;
  });
  const pause = vi.fn(async (milliseconds: number) => {
    clock += milliseconds;
  });
  const options = {
    fetchMetadata,
    pause,
    now: () => clock,
    maxWaitMs: 15_000,
    pollIntervalMs: 5_000,
    report: vi.fn(),
  };
  return {
    options,
    run: () => waitForNpmPublication(metadata.name, metadata.version, bytes, options),
  };
}

describe('npm publication propagation', () => {
  it('waits through indexing delays and verifies the exact published bytes', async () => {
    const check = fixture([
      new Response('{}', { status: 404 }),
      new Response('{}', { status: 404 }),
      Response.json(metadata),
    ]);
    await expect(check.run()).resolves.toBeUndefined();
    expect(check.options.pause).toHaveBeenCalledTimes(2);
    const [url, init] = check.options.fetchMetadata.mock.calls[0]!;
    expect(String(url)).toContain('/%40yuzuwoeser%2Fastr3/0.1.1?verification=');
    expect(init?.cache).toBe('no-store');
  });
  it('recovers from transient network and registry failures', async () => {
    const check = fixture([
      new TypeError('Network unavailable'),
      new Response('{}', { status: 503 }),
      Response.json(metadata),
    ]);
    await expect(check.run()).resolves.toBeUndefined();
  });
  it('stops on an authentication failure without retrying it', async () => {
    const check = fixture([new Response('{}', { status: 403 })]);
    await expect(check.run()).rejects.toThrow('HTTP 403');
    expect(check.options.pause).not.toHaveBeenCalled();
  });
  it('rejects mismatched package identity or tarball integrity immediately', async () => {
    for (const published of [
      { ...metadata, name: 'another-package' },
      { ...metadata, dist: { integrity: 'different' } },
    ]) {
      const check = fixture([Response.json(published)]);
      await expect(check.run()).rejects.toThrow();
      expect(check.options.pause).not.toHaveBeenCalled();
    }
  });
  it('bounds waiting and leaves an actionable draft-release error', async () => {
    const check = fixture([]);
    await expect(check.run()).rejects.toThrow('within 15s');
    expect(check.options.fetchMetadata).toHaveBeenCalledTimes(3);
  });
});
