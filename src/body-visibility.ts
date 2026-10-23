import type { BodyVisibility } from './types.js';

/** Validate and copy option records before changing a mounted chart. */
export function resolveBodyVisibility(
  patch: BodyVisibility | undefined,
  previous: BodyVisibility = {},
): BodyVisibility {
  if (patch !== undefined) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch))
      throw new RangeError('bodyVisibility must be a body-ID-to-boolean record.');
    for (const [id, visible] of Object.entries(patch))
      if (!id.trim() || typeof visible !== 'boolean')
        throw new RangeError('Body visibility needs nonempty IDs and boolean values.');
  }
  return Object.freeze({ ...previous, ...patch });
}
