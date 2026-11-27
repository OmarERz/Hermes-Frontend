import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { fillPath } from '../../core/api/api-client';
import { ApiError, NETWORK_ERROR, toApiError } from '../../core/api/api-error';
import { AuthEvents } from '../../core/auth/auth-events';
import { endsFirebaseSession } from '../../core/auth/auth.interceptor';
import { FirebaseAuthService } from '../../core/auth/firebase-auth.service';
import { APP_CONFIG } from '../../core/config/app-config';
import { isActive, RUN_STATUSES, RunStatus } from './run-labels';

/** One `progress` event of `GET /api/runs/{id}/events`: the run's progress (0-100), its status and a short text. */
export interface RunProgress {
  runId: string;
  progress: number;
  status: RunStatus | null;
  message: string;
}

/** One parsed server-sent event. */
export interface SseEvent {
  event: string;
  data: string;
}

/**
 * Splits a text/event-stream buffer into complete events (WHATWG HTML §9.2.6): lines end in LF, CRLF or CR; a blank
 * line dispatches the event; `event:` names it and each `data:` adds a line; comments (`:`) and other fields are
 * ignored. What follows the last blank line is returned as `rest`, to be completed by the next chunk.
 */
export function parseSse(buffer: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = [];
  const blocks = buffer.split(/\r\n\r\n|\n\n|\r\r/);
  const rest = blocks.pop() ?? '';
  for (const block of blocks) {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split(/\r\n|\n|\r/)) {
      if (!line || line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') event = value;
      else if (field === 'data') data.push(value);
    }
    if (data.length) events.push({ event, data: data.join('\n') });
  }
  return { events, rest };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The data of a `progress` event, or null when it is not the documented JSON (it is then skipped). */
export function toRunProgress(data: string): RunProgress | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const { run_id: runId, progress, status, message } = parsed;
  if (typeof runId !== 'string' || typeof progress !== 'number' || !Number.isFinite(progress)) {
    return null;
  }
  const known: readonly string[] = RUN_STATUSES;
  return {
    runId,
    progress: Math.max(0, Math.min(100, Math.round(progress))),
    status: typeof status === 'string' && known.includes(status) ? (status as RunStatus) : null,
    message: typeof message === 'string' ? message : '',
  };
}

/** The subset of `fetch` the stream uses, so the tests can hand in a fake. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export const RUN_EVENTS_FETCH = new InjectionToken<FetchLike>('RUN_EVENTS_FETCH', {
  providedIn: 'root',
  factory: () => (input, init) => globalThis.fetch(input, init),
});

/** Base wait before reconnecting a dropped stream; it grows with each failed attempt in a row. */
export const RUN_EVENTS_RETRY_MS = new InjectionToken<number>('RUN_EVENTS_RETRY_MS', {
  providedIn: 'root',
  factory: () => 1000,
});

/** Connection failures in a row before giving up (the screen then offers to follow the run again). */
export const MAX_RECONNECTS = 5;

/** Raised inside the loop when the stream cannot continue; carries the ApiError the screen shows. */
class StreamFailure extends Error {
  constructor(readonly error: ApiError) {
    super(error.message);
  }
}

const NETWORK_FAILURE = (): ApiError => toApiError(new HttpErrorResponse({ status: 0 }));

async function errorOf(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Not the JSON envelope (a proxy page, an empty body): the status decides the message.
  }
  return toApiError(new HttpErrorResponse({ status: response.status, error: body }));
}

/**
 * Live progress of a run over `GET /api/runs/{id}/events` (FRONTEND.md §6). The browser `EventSource` cannot send
 * the `Authorization` header, so this reads the stream with `fetch` and the Firebase ID token as a Bearer, like the
 * HTTP interceptor: a 401 forces one token refresh, and a second 401 (or a revoked session) ends the session.
 * The observable completes when the run ends (`succeeded` or `failed`). When the connection drops, or the server
 * closes the stream before the run ends, it reconnects with a growing wait; after `MAX_RECONNECTS` failures in a
 * row it errors with the network message, and an API error (403, 404, 422…) errors at once. Unsubscribing aborts
 * the request. Either way the screen asks `GET /api/runs/{id}` for the final state.
 */
@Injectable({ providedIn: 'root' })
export class RunEventsService {
  private readonly fetch = inject(RUN_EVENTS_FETCH);
  private readonly retryMs = inject(RUN_EVENTS_RETRY_MS);
  private readonly firebase = inject(FirebaseAuthService);
  private readonly events = inject(AuthEvents);
  private readonly baseUrl = inject(APP_CONFIG).apiBaseUrl;

  watch(runId: string): Observable<RunProgress> {
    return new Observable<RunProgress>((subscriber) => {
      const controller = new AbortController();
      const emit = (progress: RunProgress) => subscriber.next(progress);
      this.follow(runId, controller.signal, emit).then(
        () => subscriber.complete(),
        (error: unknown) => {
          if (controller.signal.aborted) return;
          subscriber.error(error instanceof StreamFailure ? error.error : toApiError(error));
        },
      );
      return () => controller.abort();
    });
  }

  private async follow(
    runId: string,
    signal: AbortSignal,
    emit: (progress: RunProgress) => void,
  ): Promise<void> {
    const url = `${this.baseUrl}${fillPath('/api/runs/{id}/events', { id: runId })}`;
    let failures = 0;
    while (!signal.aborted) {
      let received = false;
      try {
        const ended = await this.readOnce(url, signal, (progress) => {
          received = true;
          emit(progress);
        });
        if (ended) return;
      } catch (error) {
        if (signal.aborted) return;
        if (error instanceof StreamFailure && error.error.code !== NETWORK_ERROR) throw error;
      }
      failures = received ? 0 : failures + 1;
      if (failures >= MAX_RECONNECTS) throw new StreamFailure(NETWORK_FAILURE());
      await this.wait(this.retryMs * Math.max(1, failures), signal);
    }
  }

  /** One connection: true when the run ended, false when the stream closed before that. */
  private async readOnce(
    url: string,
    signal: AbortSignal,
    emit: (progress: RunProgress) => void,
  ): Promise<boolean> {
    const response = await this.open(url, signal);
    const reader = response.body?.getReader();
    if (!reader) throw new StreamFailure(NETWORK_FAILURE());
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await reader.read();
        } catch {
          throw new StreamFailure(NETWORK_FAILURE());
        }
        if (chunk.done) return false;
        buffer += decoder.decode(chunk.value, { stream: true });
        const parsed = parseSse(buffer);
        buffer = parsed.rest;
        for (const event of parsed.events) {
          if (event.event !== 'progress') continue;
          const progress = toRunProgress(event.data);
          if (!progress) continue;
          emit(progress);
          if (progress.status && !isActive(progress.status)) return true;
        }
      }
    } finally {
      reader.cancel().catch(() => undefined);
    }
  }

  /** Opens the stream with the Bearer token, refreshing it once on a 401. */
  private async open(url: string, signal: AbortSignal): Promise<Response> {
    let response = await this.request(url, signal, false);
    if (response.status === 401) response = await this.request(url, signal, true);
    if (response.status === 401) {
      this.events.sessionExpired.next();
      throw new StreamFailure(await errorOf(response));
    }
    if (!response.ok) throw new StreamFailure(await errorOf(response));
    return response;
  }

  private async request(url: string, signal: AbortSignal, refresh: boolean): Promise<Response> {
    let token: string | null;
    try {
      token = await this.firebase.idToken(refresh);
    } catch (error) {
      if (endsFirebaseSession(error)) {
        this.events.sessionExpired.next();
        throw new StreamFailure(toApiError(new HttpErrorResponse({ status: 401 })));
      }
      throw new StreamFailure(NETWORK_FAILURE());
    }
    const headers: Record<string, string> = { Accept: 'text/event-stream' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      return await this.fetch(url, { headers, signal, cache: 'no-store', credentials: 'omit' });
    } catch {
      throw new StreamFailure(NETWORK_FAILURE());
    }
  }

  private wait(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal.aborted) return resolve();
      const timer = setTimeout(done, ms);
      function done() {
        clearTimeout(timer);
        signal.removeEventListener('abort', done);
        resolve();
      }
      signal.addEventListener('abort', done);
    });
  }
}
