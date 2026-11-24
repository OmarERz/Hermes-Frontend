import { inject, Injectable } from '@angular/core';
import { map, Observable, of, switchMap } from 'rxjs';
import { ApiClient, ApiQuery, ApiSchema } from '../../core/api/api-client';
import type { CursorPage } from '../../shared/cursor-pager';
import { LEVELS, type Level } from '../../shared/labels';

/** Filters of the grouped views (FRO-10) that the screen offers. */
export type VulnerabilityFilters = Pick<
  ApiQuery<'/api/vulnerabilities'>,
  'band' | 'status' | 'in_kev' | 'exposed' | 'classification'
>;

export type LevelCounts = Record<Level, number>;
export type VulnerabilityGroup = ApiSchema<'VulnerabilityGroup'>;
export type AssetRisk = ApiSchema<'AssetRisk'>;
export type VulnerabilityBand = ApiSchema<'VulnerabilityBand'>;
export type VulnerabilityDetail = ApiSchema<'VulnerabilityDetail'>;
export type AffectedAsset = ApiSchema<'AffectedAsset'>;
export type ScoreHistoryPoint = ApiSchema<'ScoreHistoryPoint'>;
export type Breakdown = ApiSchema<'Breakdown'>;

/** Data of the Vulnerabilidades screens, from the existing read routes (role reader). */
@Injectable({ providedIn: 'root' })
export class VulnerabilitiesService {
  private readonly api = inject(ApiClient);

  /** One page of vulnerability groups (one row per CVE and product), most urgent first. */
  listGroups(
    filters: VulnerabilityFilters,
    cursor: string | null,
    limit: number,
  ): Observable<CursorPage<VulnerabilityGroup>> {
    return this.api
      .get('/api/vulnerabilities', { query: { ...filters, view: 'vulnerability', cursor, limit } })
      .pipe(map((page) => ({ items: page.groups ?? [], nextCursor: page.next_cursor ?? null })));
  }

  /** One page of assets with their highest risk (scores are never summed, FRO-11). */
  listAssets(
    filters: VulnerabilityFilters,
    cursor: string | null,
    limit: number,
  ): Observable<CursorPage<AssetRisk>> {
    return this.api
      .get('/api/vulnerabilities', { query: { ...filters, view: 'asset', cursor, limit } })
      .pipe(map((page) => ({ items: page.assets ?? [], nextCursor: page.next_cursor ?? null })));
  }

  /** One page of the criticality view: one band per level with its total count and the groups of the page. */
  listBands(
    filters: VulnerabilityFilters,
    cursor: string | null,
    limit: number,
  ): Observable<CursorPage<VulnerabilityBand>> {
    return this.api
      .get('/api/vulnerabilities', { query: { ...filters, view: 'criticality', cursor, limit } })
      .pipe(map((page) => ({ items: page.bands ?? [], nextCursor: page.next_cursor ?? null })));
  }

  /**
   * Groups per level in the whole filtered result, from the `criticality` view: each band carries the count of
   * all its groups, not only the page, so one row per band is enough.
   */
  levelCounts(filters: VulnerabilityFilters): Observable<LevelCounts> {
    return this.api
      .get('/api/vulnerabilities', { query: { ...filters, view: 'criticality', limit: 1 } })
      .pipe(
        map((page) => {
          const counts = Object.fromEntries(LEVELS.map((level) => [level, 0])) as LevelCounts;
          for (const band of page.bands ?? []) counts[band.level] = band.count;
          return counts;
        }),
      );
  }

  /** A vulnerability group with every affected asset (each with its `finding_id`). */
  getDetail(groupId: string): Observable<VulnerabilityDetail> {
    return this.api.get('/api/vulnerabilities/{group_id}', { path: { group_id: groupId } });
  }

  /** Score of one finding in each assessment of its group, oldest first. */
  getHistory(findingId: string): Observable<ScoreHistoryPoint[]> {
    return this.api.get('/api/findings/{id}/history', { path: { id: findingId } });
  }

  /**
   * The Δ waterfall of one asset in the latest assessment of the group. The assessment id comes from the newest
   * recommendation of the group (the comparison rows and the detail do not carry it); null when there is none.
   */
  getLatestBreakdown(groupId: string, ciId: string): Observable<Breakdown | null> {
    return this.api.get('/api/recommendations', { query: { group_id: groupId, limit: 1 } }).pipe(
      switchMap((page) => {
        const latest = page.items[0];
        if (!latest) return of(null);
        return this.api.get('/api/assessments/{id}/breakdown', {
          path: { id: latest.assessment_id },
          query: { ci_id: ciId },
        });
      }),
    );
  }
}
