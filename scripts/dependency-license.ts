import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Return the actual filename, including its casing, on every filesystem. */
export function findDependencyLicense(directory: string): string | undefined {
  const files = readdirSync(directory);
  for (const candidate of [
    'license',
    'license.txt',
    'license.md',
    'license-mit',
    'mit-license',
    'copyrightnotice.txt',
  ]) {
    const file = files.find((name) => name.toLowerCase() === candidate);
    if (file) return join(directory, file);
  }
  return undefined;
}
