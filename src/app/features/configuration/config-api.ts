import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, throwError } from 'rxjs';
import { ApiClient } from '../../core/api/api-client';
import { ApiError, toApiError } from '../../core/api/api-error';
import type { CursorPage } from '../../shared/cursor-pager';
import { withExpectedVersion } from '../../shared/versioned-save';
import type {
  CalibrationProposal,
  ConfigChanges,
  ConfigDocument,
  ConfigParameter,
  ConfigVersion,
  SimulationOutcome,
  SimulationResult,
} from './config-model';

/** The optional `not_simulable` field of the extended simulation (FRO-04), read only when it is a string list. */
function notSimulableOf(result: SimulationResult): string[] {
  const extra = (result as unknown as Record<string, unknown>)['not_simulable'];
  return Array.isArray(extra) ? extra.filter((key): key is string => typeof key === 'string') : [];
}

/**
 * Keys an older API refused to simulate: a 422 whose every detail is `unknown_parameter` on a key of the draft
 * that the schema lists outside the formula. Null when the 422 is a real validation error.
 */
export function refusedKeys(
  error: ApiError,
  changes: ConfigChanges,
  formulaKeys: ReadonlySet<string>,
): string[] | null {
  if (error.status !== 422 || !error.details.length) return null;
  const keys: string[] = [];
  for (const { field, issue } of error.details) {
    const key = field.startsWith('body.changes.') ? field.slice('body.changes.'.length) : null;
    if (
      issue !== 'unknown_parameter' ||
      key === null ||
      !(key in changes) ||
      formulaKeys.has(key)
    ) {
      return null;
    }
    keys.push(key);
  }
  return keys;
}

/**
 * Calls of the configuration screens (lane E): parameter schema and values, versioned writes with
 * `expected_version` (API-03), the formula simulation, the version history and the calibration proposals.
 */
@Injectable({ providedIn: 'root' })
export class ConfigApi {
  private readonly api = inject(ApiClient);

  schema(): Observable<ConfigParameter[]> {
    return this.api.get('/api/config/schema');
  }

  config(): Observable<ConfigDocument> {
    return this.api.get('/api/config');
  }

  /** Saves `changes` as one new version; 409 `version_conflict` when `version` is no longer the current one. */
  update(changes: ConfigChanges, version: number): Observable<ConfigDocument> {
    return this.api.put('/api/config', { body: withExpectedVersion({ changes }, version) });
  }

  /**
   * Preview of a draft without saving (FRO-04, FRO-06). The extended API answers the keys it cannot preview in
   * `not_simulable`; an older one refuses every key outside the formula with a 422, so those keys are reported
   * as not simulable and the rest of the draft (the formula part, if any) is simulated alone.
   */
  simulate(
    changes: ConfigChanges,
    formulaKeys: ReadonlySet<string>,
  ): Observable<SimulationOutcome> {
    return this.preview(changes).pipe(
      catchError((error: unknown) => {
        const failure = toApiError(error);
        const refused = refusedKeys(failure, changes, formulaKeys);
        if (!refused) return throwError(() => failure);
        const rest = Object.fromEntries(
          Object.entries(changes).filter(([key]) => !refused.includes(key)),
        );
        if (!Object.keys(rest).length) return of({ result: null, notSimulable: refused });
        return this.preview(rest).pipe(
          map((outcome) => ({ ...outcome, notSimulable: [...refused, ...outcome.notSimulable] })),
        );
      }),
    );
  }

  versions(cursor: string | null, limit: number): Observable<CursorPage<ConfigVersion>> {
    return this.api
      .get('/api/config/versions', { query: { cursor, limit } })
      .pipe(map((page) => ({ items: page.items, nextCursor: page.next_cursor ?? null })));
  }

  /** Makes version `target` current again as a new version (admin); `version` is the one the screen read. */
  restore(target: number, version: number): Observable<ConfigDocument> {
    return this.api.post('/api/config/versions/{v}/restore', {
      path: { v: target },
      body: withExpectedVersion({}, version),
    });
  }

  proposals(cursor: string | null, limit: number): Observable<CursorPage<CalibrationProposal>> {
    return this.api
      .get('/api/calibration/proposals', { query: { cursor, limit } })
      .pipe(map((page) => ({ items: page.items, nextCursor: page.next_cursor ?? null })));
  }

  approve(id: string): Observable<CalibrationProposal> {
    return this.api.post('/api/calibration/proposals/{id}/approve', { path: { id } });
  }

  reject(id: string): Observable<CalibrationProposal> {
    return this.api.post('/api/calibration/proposals/{id}/reject', { path: { id } });
  }

  private preview(changes: ConfigChanges): Observable<SimulationOutcome> {
    return this.api
      .post('/api/formula/simulate', { body: { changes } })
      .pipe(map((result) => ({ result, notSimulable: notSimulableOf(result) })));
  }
}
