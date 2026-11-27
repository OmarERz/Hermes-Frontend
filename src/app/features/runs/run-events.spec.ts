import { TestBed } from '@angular/core/testing';
import { firstValueFrom, lastValueFrom, toArray } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { AuthEvents } from '../../core/auth/auth-events';
import { FirebaseAuthService } from '../../core/auth/firebase-auth.service';
import { APP_CONFIG } from '../../core/config/app-config';
import {
  FetchLike,
  MAX_RECONNECTS,
  parseSse,
  RUN_EVENTS_FETCH,
  RUN_EVENTS_RETRY_MS,
  RunEventsService,
  toRunProgress,
} from './run-events';

const RUN_ID = '0196a6f0-0000-7000-8000-000000000001';
const URL = `http://127.0.0.1:8000/api/runs/${RUN_ID}/events`;

function event(progress: number, status: string): string {
  const data = JSON.stringify({ run_id: RUN_ID, progress, status, message: 'En curso' });
  return `event: progress\ndata: ${data}\n\n`;
}

/** A streamed answer: each chunk comes from one read; then the stream ends (or breaks). */
function streamed(chunks: string[], options: { breakAtEnd?: boolean } = {}): Response {
  const encoder = new TextEncoder();
  let index = 0;
  const reader = {
    read: async () => {
      if (index < chunks.length) return { done: false, value: encoder.encode(chunks[index++]) };
      if (options.breakAtEnd) throw new TypeError('network error');
      return { done: true, value: undefined };
    },
    cancel: async () => undefined,
  };
  return {
    ok: true,
    status: 200,
    body: { getReader: () => reader },
    json: async () => null,
  } as unknown as Response;
}

function refused(status: number, body: unknown): Response {
  return {
    ok: false,
    status,
    body: null,
    json: async () => {
      if (body === undefined) throw new SyntaxError('not json');
      return body;
    },
  } as unknown as Response;
}

function setup(answers: (Response | Error)[], idToken?: (refresh: boolean) => Promise<string>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = vi.fn<FetchLike>(async (url, init) => {
    calls.push({ url, init });
    const answer = answers.shift();
    if (!answer) throw new TypeError('no more answers');
    if (answer instanceof Error) throw answer;
    return answer;
  });
  const firebase = {
    idToken: vi.fn(idToken ?? (async (refresh: boolean) => (refresh ? 'fresh-token' : 'token'))),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: APP_CONFIG, useValue: { apiBaseUrl: 'http://127.0.0.1:8000' } },
      { provide: RUN_EVENTS_FETCH, useValue: fetch },
      { provide: RUN_EVENTS_RETRY_MS, useValue: 0 },
      { provide: FirebaseAuthService, useValue: firebase },
    ],
  });
  const expired = vi.fn();
  TestBed.inject(AuthEvents).sessionExpired.subscribe(expired);
  return { service: TestBed.inject(RunEventsService), fetch, calls, firebase, expired };
}

describe('parseSse', () => {
  it('splits complete events and keeps the unfinished tail', () => {
    const { events, rest } = parseSse(
      'event: progress\ndata: {"a":1}\n\n: comment\r\nevent: progress\r\ndata: x\r\ndata: y\r\n\r\nevent: pro',
    );
    expect(events).toEqual([
      { event: 'progress', data: '{"a":1}' },
      { event: 'progress', data: 'x\ny' },
    ]);
    expect(rest).toBe('event: pro');
  });

  it('names an unnamed event "message", ignores other fields and drops events without data', () => {
    const { events } = parseSse('data:plain\nid: 7\nretry: 10\n\nevent: progress\n\nfield\n\n');
    expect(events).toEqual([{ event: 'message', data: 'plain' }]);
  });
});

describe('toRunProgress', () => {
  it('reads the progress, the status and the message', () => {
    expect(
      toRunProgress('{"run_id":"r1","progress":42.6,"status":"running","message":"En curso"}'),
    ).toEqual({ runId: 'r1', progress: 43, status: 'running', message: 'En curso' });
  });

  it('clamps the progress and leaves out an unknown status or message', () => {
    expect(toRunProgress('{"run_id":"r1","progress":130,"status":"cancelled"}')).toEqual({
      runId: 'r1',
      progress: 100,
      status: null,
      message: '',
    });
  });

  it('skips anything that is not the documented JSON', () => {
    expect(toRunProgress('not json')).toBeNull();
    expect(toRunProgress('[1,2]')).toBeNull();
    expect(toRunProgress('{"progress":5}')).toBeNull();
    expect(toRunProgress('{"run_id":"r1","progress":"5"}')).toBeNull();
  });
});

describe('RunEventsService', () => {
  it('emits every progress event in order and stops at the final status', async () => {
    const { service, calls } = setup([
      streamed([event(10, 'running'), event(55, 'running') + event(100, 'succeeded')]),
    ]);
    const progress = await lastValueFrom(service.watch(RUN_ID).pipe(toArray()));
    expect(progress.map((item) => [item.progress, item.status])).toEqual([
      [10, 'running'],
      [55, 'running'],
      [100, 'succeeded'],
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(URL);
    expect(calls[0].init.headers).toEqual({
      Accept: 'text/event-stream',
      Authorization: 'Bearer token',
    });
    expect(calls[0].init.cache).toBe('no-store');
  });

  it('joins an event split across chunks and skips other events and bad data', async () => {
    const { service } = setup([
      streamed([
        'event: progress\ndata: {"run_id":"',
        `${RUN_ID}","progress":30,"status":"running"}\n\n`,
        'event: ping\ndata: {}\n\nevent: progress\ndata: nope\n\n',
        event(100, 'failed'),
      ]),
    ]);
    const progress = await lastValueFrom(service.watch(RUN_ID).pipe(toArray()));
    expect(progress.map((item) => item.progress)).toEqual([30, 100]);
    expect(progress[1].status).toBe('failed');
  });

  it('reconnects when the server closes the stream before the run ends', async () => {
    const { service, fetch } = setup([
      streamed([event(20, 'running')]),
      streamed([event(60, 'running')], { breakAtEnd: true }),
      streamed([event(100, 'succeeded')]),
    ]);
    const progress = await lastValueFrom(service.watch(RUN_ID).pipe(toArray()));
    expect(progress.map((item) => item.progress)).toEqual([20, 60, 100]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('refreshes the token once on a 401 and goes on', async () => {
    const { service, calls, firebase, expired } = setup([
      refused(401, { error: { code: 'unauthorized', message: 'Token expirado.' } }),
      streamed([event(100, 'succeeded')]),
    ]);
    const progress = await lastValueFrom(service.watch(RUN_ID).pipe(toArray()));
    expect(progress).toHaveLength(1);
    expect(firebase.idToken).toHaveBeenLastCalledWith(true);
    expect((calls[1].init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer fresh-token',
    );
    expect(expired).not.toHaveBeenCalled();
  });

  it('ends the session when the API still answers 401 after the refresh', async () => {
    const { service, fetch, expired } = setup([
      refused(401, { error: { code: 'unauthorized', message: 'Token expirado.' } }),
      refused(401, { error: { code: 'unauthorized', message: 'Token revocado.' } }),
    ]);
    const failure = await firstValueFrom(service.watch(RUN_ID)).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(401);
    expect((failure as ApiError).message).toBe('Token revocado.');
    expect(expired).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('fails at once with the message of an API error, without reconnecting', async () => {
    const { service, fetch } = setup([
      refused(404, { error: { code: 'not_found', message: 'La corrida no existe.' } }),
    ]);
    const failure = (await firstValueFrom(service.watch(RUN_ID)).catch(
      (error: unknown) => error,
    )) as ApiError;
    expect(failure.code).toBe('not_found');
    expect(failure.message).toBe('La corrida no existe.');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to the status message when the error is not the JSON envelope', async () => {
    const { service } = setup([refused(500, undefined)]);
    const failure = (await firstValueFrom(service.watch(RUN_ID)).catch(
      (error: unknown) => error,
    )) as ApiError;
    expect(failure.status).toBe(500);
    expect(failure.message).toBe('Ocurrió un error en el servidor. Intenta de nuevo más tarde.');
  });

  it('gives up with the network message after too many failed connections in a row', async () => {
    const answers = Array.from({ length: MAX_RECONNECTS }, () => new TypeError('offline'));
    const { service, fetch } = setup(answers);
    const failure = (await firstValueFrom(service.watch(RUN_ID)).catch(
      (error: unknown) => error,
    )) as ApiError;
    expect(failure.code).toBe('network_error');
    expect(fetch).toHaveBeenCalledTimes(MAX_RECONNECTS);
  });

  it('counts a response without a body as a failed connection', async () => {
    const empty = {
      ok: true,
      status: 200,
      body: null,
      json: async () => null,
    } as unknown as Response;
    const { service, fetch } = setup([empty, streamed([event(100, 'succeeded')])]);
    const progress = await lastValueFrom(service.watch(RUN_ID).pipe(toArray()));
    expect(progress).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('ends the session when Firebase refuses to give a token', async () => {
    const { service, fetch, expired } = setup([], async () => {
      throw Object.assign(new Error('revoked'), { code: 'auth/user-token-expired' });
    });
    const failure = (await firstValueFrom(service.watch(RUN_ID)).catch(
      (error: unknown) => error,
    )) as ApiError;
    expect(failure.status).toBe(401);
    expect(expired).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('retries when Firebase cannot give a token for a transient reason', async () => {
    let first = true;
    const { service } = setup([streamed([event(100, 'succeeded')])], async () => {
      if (first) {
        first = false;
        throw Object.assign(new Error('offline'), { code: 'auth/network-request-failed' });
      }
      return 'token';
    });
    const progress = await lastValueFrom(service.watch(RUN_ID).pipe(toArray()));
    expect(progress).toHaveLength(1);
  });

  it('sends no Authorization header without a signed-in user', async () => {
    const { service, calls } = setup([streamed([event(100, 'succeeded')])], async () => '');
    await lastValueFrom(service.watch(RUN_ID).pipe(toArray()));
    expect(calls[0].init.headers).toEqual({ Accept: 'text/event-stream' });
  });

  it('aborts the request when the screen stops following the run', async () => {
    let signal: AbortSignal | undefined;
    const { service } = setup([]);
    const fetch = TestBed.inject(RUN_EVENTS_FETCH) as unknown as ReturnType<typeof vi.fn>;
    fetch.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          signal = init.signal ?? undefined;
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted')));
        }),
    );
    const next = vi.fn();
    const error = vi.fn();
    const subscription = service.watch(RUN_ID).subscribe({ next, error });
    await vi.waitFor(() => expect(signal).toBeDefined());
    subscription.unsubscribe();
    expect(signal?.aborted).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(error).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
