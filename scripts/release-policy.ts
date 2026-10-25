import { createHash } from 'node:crypto';

export function validateCandidate({
  tag,
  version,
  commit,
  manifestCommit,
  onMain,
}: {
  tag: string;
  version: string;
  commit: string;
  manifestCommit: string;
  onMain: boolean;
}) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag) || tag !== `v${version}`)
    throw new Error('Release tag must be vX.Y.Z and match package.json.');
  if (!onMain) throw new Error('Release commit must be reachable from origin/main.');
  if (commit !== manifestCommit)
    throw new Error('Release artifacts were built from another commit.');
}

export function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function verifyExisting(name: string, expected: string, actual: string) {
  if (expected !== actual)
    throw new Error(`Published artifact differs: ${name}. Refusing to overwrite it.`);
}

export function verifyNpm(bytes: Uint8Array, metadata: { dist?: { integrity?: string } }) {
  const expected = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
  if (metadata.dist?.integrity !== expected)
    throw new Error('Published npm tarball differs. Refusing to publish.');
}

/** npm can acknowledge a publication before its public registry has indexed it. */
export async function waitForNpmPublication(
  name: string,
  version: string,
  bytes: Uint8Array,
  {
    fetchMetadata = fetch,
    pause = (milliseconds: number) => new Promise<void>((done) => setTimeout(done, milliseconds)),
    now = Date.now,
    maxWaitMs = 300_000,
    pollIntervalMs = 5_000,
    report = (message: string) => console.log(message),
  }: {
    fetchMetadata?: typeof fetch;
    pause?: (milliseconds: number) => Promise<void>;
    now?: () => number;
    maxWaitMs?: number;
    pollIntervalMs?: number;
    report?: (message: string) => void;
  } = {},
) {
  const deadline = now() + maxWaitMs;
  let pending = 'version is not yet indexed';
  while (now() < deadline) {
    let response: Response | undefined;
    try {
      response = await fetchMetadata(
        `https://registry.npmjs.org/${encodeURIComponent(name)}/${version}?verification=${now()}`,
        {
          cache: 'no-store',
          headers: { 'cache-control': 'no-cache' },
          signal: AbortSignal.timeout(Math.max(1, Math.min(10_000, deadline - now()))),
        },
      );
    } catch (error) {
      if (
        !(error instanceof TypeError) &&
        !(error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name))
      )
        throw error;
      pending = 'registry request temporarily unavailable';
    }
    if (response?.ok) {
      const metadata = await response.json();
      if (metadata.name !== name || metadata.version !== version)
        throw new Error('Registry returned a different package or version.');
      verifyNpm(bytes, metadata);
      return;
    }
    if (response) {
      if (response.status !== 404 && response.status !== 429 && response.status < 500)
        throw new Error(
          `npm verification failed: HTTP ${response.status}. Release remains a draft.`,
        );
      pending = `registry HTTP ${response.status}`;
    }
    const remaining = deadline - now();
    if (remaining <= 0) break;
    report(`Waiting for npm to index ${name}@${version}: ${pending}.`);
    await pause(Math.min(pollIntervalMs, remaining));
  }
  throw new Error(
    `npm publication could not be confirmed within ${maxWaitMs / 1000}s (${pending}); release remains a draft. Rerun to resume.`,
  );
}
