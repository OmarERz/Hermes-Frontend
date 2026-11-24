import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { toApiError } from './api-error';
import type {
  CurrentUser,
  ListVulnerabilitiesQuery,
  OperationResult,
  VulnerabilityList,
} from './api-types';

type QueryValue = string | number | boolean | null | undefined;

/** Builds query parameters, leaving out empty values (the API treats a missing filter as "any"). */
export function toHttpParams(query: Record<string, QueryValue> = {}): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue;
    params = params.set(key, String(value));
  }
  return params;
}

/**
 * Typed client of the backend API (one method per operationId of the OpenAPI). Every failure comes out as an
 * ApiError with a Spanish message; the bearer token is added by the auth interceptor.
 */
@Injectable({ providedIn: 'root' })
export class HermesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(APP_CONFIG).apiBaseUrl;

  /** `get_current_user`: the signed-in user and the effective role (FRONTEND.md §2). */
  getCurrentUser(): Observable<CurrentUser> {
    return this.get<OperationResult<'get_current_user'>>('/api/me');
  }

  /** `list_vulnerabilities`: grouped view (vulnerability, criticality or asset), paginated by cursor. */
  listVulnerabilities(query: ListVulnerabilitiesQuery = {}): Observable<VulnerabilityList> {
    return this.get<OperationResult<'list_vulnerabilities'>>('/api/vulnerabilities', query);
  }

  private get<T>(path: string, query?: Record<string, QueryValue>): Observable<T> {
    return this.http
      .get<T>(`${this.baseUrl}${path}`, { params: toHttpParams(query) })
      .pipe(catchError((error: unknown) => throwError(() => toApiError(error))));
  }
}
