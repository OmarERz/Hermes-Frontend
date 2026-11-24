import { ApiError } from '../core/api/api-error';

/** One row of the before/after confirmation (the prototype's change list). */
export interface ChangeRow {
  name: string;
  before: string;
  after: string;
  impact?: string;
}

/**
 * Optimistic concurrency (FRONTEND.md §5): every versioned write sends the version the screen read as
 * `expected_version`; a 409 `version_conflict` means someone saved in between, so the screen shows it and offers
 * to reload instead of overwriting. Applies to PUT /api/config, POST /api/config/versions/{v}/restore and
 * PUT /api/profile.
 */
export function withExpectedVersion<T extends object>(
  body: T,
  version: number,
): T & { expected_version: number } {
  return { ...body, expected_version: version };
}

export function isVersionConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409 && error.code === 'version_conflict';
}

export const VERSION_CONFLICT_MESSAGE =
  'Alguien guardó cambios mientras editabas. Recarga para ver la versión actual y vuelve a aplicar tus cambios.';
