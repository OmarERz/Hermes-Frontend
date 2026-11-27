import { inject, Injectable } from '@angular/core';
import { defer, EMPTY, expand, map, Observable, reduce } from 'rxjs';
import { ApiClient, ApiQuery, ApiSchema } from '../../core/api/api-client';
import type { CursorPage } from '../../shared/cursor-pager';

export type InventoryAsset = ApiSchema<'InventoryAsset'>;
export type InventorySummary = ApiSchema<'InventorySummary'>;
export type SoftwareItem = ApiSchema<'SoftwareItem'>;
export type InstalledSoftware = ApiSchema<'InstalledSoftwareItem'>;
export type SoftwareLicence = ApiSchema<'SoftwareLicenceInfo'>;
export type CatalogueLicence = ApiSchema<'CatalogueLicence'>;
export type AssetDetail = ApiSchema<'AssetDetail'>;
export type AssetFinding = AssetDetail['findings'][number];
export type InventoryPending = ApiSchema<'InventoryPending'>;
export type PendingItem = ApiSchema<'InventoryItem'>;
export type CpeCandidate = ApiSchema<'CpeCandidate'>;
export type Mapping = ApiSchema<'Mapping'>;

/** Filters of `GET /api/inventory/assets` (the page and the cursor are the pager's). */
export type AssetFilters = Omit<ApiQuery<'/api/inventory/assets'>, 'cursor' | 'limit'>;
/** Filters of `GET /api/inventory/software`. */
export type SoftwareFilters = Omit<ApiQuery<'/api/inventory/software'>, 'cursor' | 'limit'>;

/** The whole catalogue (every page), and whether it was cut at the page cap. */
export interface Catalogue {
  items: SoftwareItem[];
  complete: boolean;
}

/** Largest page the API serves (FRONTEND.md §5). */
export const MAX_PAGE_SIZE = 200;
/** Pages read for the catalogue totals: up to 4 000 products, far above an iTop inventory of this project. */
export const MAX_CATALOGUE_PAGES = 20;

/**
 * Data of the Inventario screens: the read-only iTop inventory (D-003, D-088) and the CPE mapping (ESC-05, ESC-06).
 * Reads are for readers; the CPE search and the mapping are for analysts and admins (ROUTE_ROLES).
 */
@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly api = inject(ApiClient);

  /** One page of live CIs, alphabetical, with their findings and iTop fields. */
  listAssets(
    filters: AssetFilters,
    cursor: string | null,
    limit: number,
  ): Observable<CursorPage<InventoryAsset>> {
    return this.api
      .get('/api/inventory/assets', { query: { ...filters, cursor, limit } })
      .pipe(map((page) => ({ items: page.items, nextCursor: page.next_cursor ?? null })));
  }

  /**
   * The inventory row of one CI (criticality, exposure, OS, service, iTop link…), which the detail route does not
   * carry: the search matches the name or the id, so the exact id is picked from the matches; null if none.
   */
  findAsset(ciId: string): Observable<InventoryAsset | null> {
    return this.api
      .get('/api/inventory/assets', { query: { q: ciId, limit: MAX_PAGE_SIZE } })
      .pipe(map((page) => page.items.find((asset) => asset.ci_id === ciId) ?? null));
  }

  /** Totals of the live inventory and the health of its software (already computed by the API). */
  summary(): Observable<InventorySummary> {
    return this.api.get('/api/inventory/summary');
  }

  /** One page of the software catalogue, alphabetical. */
  listSoftware(
    filters: SoftwareFilters,
    cursor: string | null,
    limit: number,
  ): Observable<CursorPage<SoftwareItem>> {
    return this.api
      .get('/api/inventory/software', { query: { ...filters, cursor, limit } })
      .pipe(map((page) => ({ items: page.items, nextCursor: page.next_cursor ?? null })));
  }

  /**
   * Every product of the catalogue, for its totals by category, status and licence (they count installations and
   * the API gives them per product). Follows `next_cursor` page by page, up to MAX_CATALOGUE_PAGES.
   */
  catalogue(): Observable<Catalogue> {
    const page = (cursor: string | null) =>
      this.api.get('/api/inventory/software', { query: { cursor, limit: MAX_PAGE_SIZE } });
    return defer(() => {
      let read = 0;
      return page(null).pipe(
        expand((current) => {
          read += 1;
          return current.next_cursor && read < MAX_CATALOGUE_PAGES
            ? page(current.next_cursor)
            : EMPTY;
        }),
        reduce<{ items: SoftwareItem[]; next_cursor?: string | null }, Catalogue>(
          (all, current) => ({
            items: [...all.items, ...current.items],
            complete: !current.next_cursor,
          }),
          { items: [], complete: true },
        ),
      );
    });
  }

  /** The live software installations of a CI, with their CPE, findings and iTop fields. */
  assetSoftware(ciId: string): Observable<InstalledSoftware[]> {
    return this.api.get('/api/inventory/assets/{ci_id}/software', { path: { ci_id: ciId } });
  }

  /** A CI with its risk and its vulnerability groups (and its iTop CPU, RAM, description and class). */
  asset(ciId: string): Observable<AssetDetail> {
    return this.api.get('/api/assets/{ci_id}', { path: { ci_id: ciId } });
  }

  /** Inventory items waiting for a person (FRO-17, ESC-03c, ESC-07), up to 200 per type. */
  pending(): Observable<InventoryPending> {
    return this.api.get('/api/pending/inventory');
  }

  /** CPE candidates for a search text (2 to 100 characters): NVD's dictionary plus what Hermes already holds. */
  cpeCandidates(q: string): Observable<CpeCandidate[]> {
    return this.api.get('/api/cpe/candidates', { query: { q } });
  }

  /** Maps a software product (its UUID) to a CPE 2.3 name (ESC-05). */
  setMapping(softwareId: string, cpe: string): Observable<Mapping> {
    return this.api.put('/api/mappings/{software}', {
      path: { software: softwareId },
      body: { cpe },
    });
  }
}
