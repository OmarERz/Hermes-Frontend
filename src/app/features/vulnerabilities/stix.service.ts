import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiBody, ApiClient, ApiSchema } from '../../core/api/api-client';
import type { CursorPage } from '../../shared/cursor-pager';

export type StixExportRequest = ApiBody<'/api/stix/export', 'post'>;
export type StixBundle = ApiSchema<'StixBundle'>;
export type Run = ApiSchema<'Run'>;

/** STIX 2.1 export (role analyst) and the runs it can export. */
@Injectable({ providedIn: 'root' })
export class StixService {
  private readonly api = inject(ApiClient);

  /** The bundle of one vulnerability, one run or a date range, respecting the TLP. */
  exportBundle(request: StixExportRequest): Observable<StixBundle> {
    return this.api.post('/api/stix/export', { body: request });
  }

  /** Saves a bundle as a JSON file in the browser. */
  download(bundle: StixBundle, fileName: string): void {
    downloadJson(bundle, fileName);
  }

  /** One page of runs, newest first, to pick one to export. */
  listRuns(cursor: string | null, limit: number): Observable<CursorPage<Run>> {
    return this.api
      .get('/api/runs', { query: { cursor, limit } })
      .pipe(map((page) => ({ items: page.items, nextCursor: page.next_cursor ?? null })));
  }
}

/** Saves the bundle as a JSON file in the browser. */
export function downloadJson(data: unknown, fileName: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}
