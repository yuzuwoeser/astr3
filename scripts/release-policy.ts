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
