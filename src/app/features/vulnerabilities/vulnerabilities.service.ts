import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import type { ListVulnerabilitiesQuery, VulnerabilityGroup } from '../../core/api/api-types';
import { HermesApi } from '../../core/api/hermes-api';
import type { CursorPage } from '../../shared/cursor-pager';
import { LEVELS, type Level } from '../../shared/labels';

/** Filters of the grouped view (FRO-10) that the screen offers. */
export type VulnerabilityFilters = Pick<
  ListVulnerabilitiesQuery,
  'band' | 'status' | 'in_kev' | 'exposed' | 'classification'
>;

export type LevelCounts = Record<Level, number>;

/** Data of the Vulnerabilidades screen, from `GET /api/vulnerabilities` (role reader). */
@Injectable({ providedIn: 'root' })
export class VulnerabilitiesService {
  private readonly api = inject(HermesApi);

  /** One page of vulnerability groups (one row per CVE and product), most urgent first. */
  listGroups(
    filters: VulnerabilityFilters,
    cursor: string | null,
    limit: number,
  ): Observable<CursorPage<VulnerabilityGroup>> {
    return this.api
      .listVulnerabilities({ ...filters, view: 'vulnerability', cursor, limit })
      .pipe(map((page) => ({ items: page.groups ?? [], nextCursor: page.next_cursor ?? null })));
  }

  /**
   * Groups per level in the whole filtered result, from the `criticality` view: each band carries the count of
   * all its groups, not only the page, so one row per band is enough.
   */
  levelCounts(filters: VulnerabilityFilters): Observable<LevelCounts> {
    return this.api.listVulnerabilities({ ...filters, view: 'criticality', limit: 1 }).pipe(
      map((page) => {
        const counts = Object.fromEntries(LEVELS.map((level) => [level, 0])) as LevelCounts;
        for (const band of page.bands ?? []) counts[band.level] = band.count;
        return counts;
      }),
    );
  }
}
