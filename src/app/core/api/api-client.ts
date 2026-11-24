import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { toApiError } from './api-error';
import type { components, paths } from './schema';

/**
 * Generic typed client of the backend API, keyed by the OpenAPI path: `api.get('/api/inventory/assets', {query})`.
 * Path parameters, query, body and result come from the generated types (src/app/core/api/schema.d.ts), so a
 * screen calls any route without editing a shared file. Every failure comes out as an ApiError (Spanish message);
 * the bearer token is added by the auth interceptor.
 */

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

/** Paths that declare `method` in the OpenAPI. */
export type ApiPath<M extends HttpMethod> = {
  [P in keyof paths]: paths[P] extends Record<M, infer O>
    ? [O] extends [never]
      ? never
      : P
    : never;
}[keyof paths];

/** The operation behind `method` + `path`. */
export type ApiOperation<P extends keyof paths, M extends HttpMethod> =
  paths[P] extends Record<M, infer O> ? O : never;

type Parameters<O> = O extends { parameters: infer X } ? X : never;
type PathParams<O> = Parameters<O> extends { path: infer X } ? X : never;
type QueryParams<O> = Parameters<O> extends { query?: infer Q } ? NonNullable<Q> : never;
type RequestBody<O> = O extends { requestBody: { content: { 'application/json': infer B } } }
  ? B
  : O extends { requestBody?: { content: { 'application/json': infer B } } }
    ? B | undefined
    : never;

type JsonOf<R> = R extends { content: { 'application/json': infer T } } ? T : void;
type SuccessResult<R> = R extends { 200: infer X }
  ? JsonOf<X>
  : R extends { 201: infer X }
    ? JsonOf<X>
    : R extends { 202: infer X }
      ? JsonOf<X>
      : R extends { 204: unknown }
        ? void
        : unknown;

/** JSON body of the success response (200, 201 or 202; void for 204). */
export type ApiResult<P extends keyof paths, M extends HttpMethod> =
  ApiOperation<P, M> extends {
    responses: infer R;
  }
    ? SuccessResult<R>
    : never;

/** Query parameters of a route. */
export type ApiQuery<P extends keyof paths, M extends HttpMethod = 'get'> = QueryParams<
  ApiOperation<P, M>
>;

/** JSON body of a route. */
export type ApiBody<P extends keyof paths, M extends HttpMethod> = RequestBody<ApiOperation<P, M>>;

/** A schema of the OpenAPI components by name: `ApiSchema<'VulnerabilityGroup'>`. */
export type ApiSchema<N extends keyof components['schemas']> = components['schemas'][N];

type PathOption<O> = [PathParams<O>] extends [never] ? { path?: never } : { path: PathParams<O> };
type QueryOption<O> = [QueryParams<O>] extends [never]
  ? { query?: never }
  : { query?: QueryParams<O> };
type BodyOption<O> = [RequestBody<O>] extends [never]
  ? { body?: never }
  : undefined extends RequestBody<O>
    ? { body?: RequestBody<O> }
    : { body: RequestBody<O> };

/** Options of a call: `path` (required when the route has path parameters), `query` and `body`. */
export type ApiRequestOptions<O> = PathOption<O> & QueryOption<O> & BodyOption<O>;

/** The options argument is optional only when nothing in it is required. */
type OptionsArgument<O> =
  Record<string, never> extends ApiRequestOptions<O>
    ? [options?: ApiRequestOptions<O>]
    : [options: ApiRequestOptions<O>];

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

/** Replaces each `{name}` of the OpenAPI path with its URL-encoded value. */
export function fillPath(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{([^}]+)\}/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined || value === null || value === '') {
      throw new Error(`Missing path parameter: ${name}`);
    }
    return encodeURIComponent(String(value));
  });
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(APP_CONFIG).apiBaseUrl;

  get<P extends ApiPath<'get'>>(
    path: P,
    ...[options]: OptionsArgument<ApiOperation<P, 'get'>>
  ): Observable<ApiResult<P, 'get'>> {
    return this.request('GET', path, options);
  }

  post<P extends ApiPath<'post'>>(
    path: P,
    ...[options]: OptionsArgument<ApiOperation<P, 'post'>>
  ): Observable<ApiResult<P, 'post'>> {
    return this.request('POST', path, options);
  }

  put<P extends ApiPath<'put'>>(
    path: P,
    ...[options]: OptionsArgument<ApiOperation<P, 'put'>>
  ): Observable<ApiResult<P, 'put'>> {
    return this.request('PUT', path, options);
  }

  patch<P extends ApiPath<'patch'>>(
    path: P,
    ...[options]: OptionsArgument<ApiOperation<P, 'patch'>>
  ): Observable<ApiResult<P, 'patch'>> {
    return this.request('PATCH', path, options);
  }

  delete<P extends ApiPath<'delete'>>(
    path: P,
    ...[options]: OptionsArgument<ApiOperation<P, 'delete'>>
  ): Observable<ApiResult<P, 'delete'>> {
    return this.request('DELETE', path, options);
  }

  private request<T>(
    method: string,
    path: string,
    options?: { path?: unknown; query?: unknown; body?: unknown },
  ): Observable<T> {
    let url: string;
    try {
      url = `${this.baseUrl}${fillPath(path, options?.path as Record<string, string | number>)}`;
    } catch (error) {
      return throwError(() => toApiError(error));
    }
    return this.http
      .request<T>(method, url, {
        params: toHttpParams(options?.query as Record<string, QueryValue> | undefined),
        body: options?.body,
      })
      .pipe(catchError((error: unknown) => throwError(() => toApiError(error))));
  }
}
