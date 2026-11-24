import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiBody, ApiClient, ApiSchema } from '../../core/api/api-client';

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

  /** The latest runs, to pick one to export. */
  latestRuns(limit = 50): Observable<Run[]> {
    return this.api.get('/api/runs', { query: { limit } }).pipe(map((page) => page.items));
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
