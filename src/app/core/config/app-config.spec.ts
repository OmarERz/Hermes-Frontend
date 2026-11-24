import { AppConfig, loadAppConfig, mergeRuntimeConfig, RuntimeConfigError } from './app-config';

const defaults: AppConfig = {
  production: false,
  apiBaseUrl: 'http://127.0.0.1:8000',
  firebase: { apiKey: 'demo', authDomain: 'demo.firebaseapp.com', projectId: 'demo', appId: 'app' },
  authEmulatorUrl: 'http://127.0.0.1:9099',
  itopBaseUrl: null,
};

const realFirebase = {
  apiKey: 'key',
  authDomain: 'hermes-pass-sec.firebaseapp.com',
  projectId: 'hermes-pass-sec',
  appId: '1:2:web:3',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('mergeRuntimeConfig', () => {
  it('overrides only the fields present in the file', () => {
    const merged = mergeRuntimeConfig(defaults, { firebase: realFirebase, authEmulatorUrl: null });
    expect(merged.firebase).toEqual(realFirebase);
    expect(merged.authEmulatorUrl).toBeNull();
    expect(merged.apiBaseUrl).toBe(defaults.apiBaseUrl);
    expect(merged.production).toBe(false);
  });

  it('accepts the same origin and drops trailing slashes from the API URL', () => {
    expect(mergeRuntimeConfig(defaults, { apiBaseUrl: '' }).apiBaseUrl).toBe('');
    expect(mergeRuntimeConfig(defaults, { apiBaseUrl: 'https://hermes.test/' }).apiBaseUrl).toBe(
      'https://hermes.test',
    );
  });

  it.each([
    [{ apiBaseUrl: 'javascript:alert(1)' }, 'apiBaseUrl debe usar http o https.'],
    [{ apiBaseUrl: 'https://hermes.test/?x=1' }, 'apiBaseUrl no puede llevar'],
    [{ authEmulatorUrl: 42 }, 'authEmulatorUrl debe ser texto.'],
    [{ itopBaseUrl: 'ftp://itop.test' }, 'itopBaseUrl debe usar http o https.'],
    [{ firebase: { ...realFirebase, appId: '' } }, 'firebase.appId es obligatorio.'],
    [{ firebase: { ...realFirebase, extra: 'x' } }, 'firebase.extra no es un campo conocido.'],
    [{ firebse: realFirebase }, 'firebse no es un campo conocido.'],
    [[], 'El archivo debe contener un objeto JSON.'],
  ])('rejects %j', (raw, message) => {
    expect(() => mergeRuntimeConfig(defaults, raw)).toThrowError(RuntimeConfigError);
    expect(() => mergeRuntimeConfig(defaults, raw)).toThrowError(message);
  });
});

describe('mergeRuntimeConfig in production', () => {
  const production: AppConfig = {
    ...defaults,
    production: true,
    apiBaseUrl: '',
    authEmulatorUrl: null,
  };

  it('refuses the Auth emulator', () => {
    expect(() =>
      mergeRuntimeConfig(production, { authEmulatorUrl: 'http://127.0.0.1:9099' }),
    ).toThrowError('authEmulatorUrl no se permite en producción.');
  });

  it('refuses a plain http iTop console on a remote host', () => {
    expect(() =>
      mergeRuntimeConfig(production, { itopBaseUrl: 'http://itop.hermes.test' }),
    ).toThrowError('itopBaseUrl debe usar https en producción.');
    expect(
      mergeRuntimeConfig(production, { itopBaseUrl: 'https://itop.hermes.test/' }).itopBaseUrl,
    ).toBe('https://itop.hermes.test');
  });

  it('refuses plain http to a remote API but accepts https and a local API', () => {
    expect(() => mergeRuntimeConfig(production, { apiBaseUrl: 'http://hermes.test' })).toThrowError(
      'apiBaseUrl debe usar https en producción.',
    );
    expect(mergeRuntimeConfig(production, { apiBaseUrl: 'https://hermes.test' }).apiBaseUrl).toBe(
      'https://hermes.test',
    );
    expect(mergeRuntimeConfig(production, { apiBaseUrl: 'http://127.0.0.1:8000' }).apiBaseUrl).toBe(
      'http://127.0.0.1:8000',
    );
    expect(mergeRuntimeConfig(production, { firebase: realFirebase }).firebase).toEqual(
      realFirebase,
    );
  });
});

describe('loadAppConfig', () => {
  const base = 'http://localhost:4200/';

  it('reads runtime-config.json next to index.html without caching it', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ firebase: realFirebase }));
    const config = await loadAppConfig(defaults, base, fetchFn);
    expect(fetchFn).toHaveBeenCalledWith('http://localhost:4200/runtime-config.json', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    expect(config.firebase).toEqual(realFirebase);
  });

  it('keeps the defaults when the file is missing, unreachable or the HTML fallback', async () => {
    const html = new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } });
    for (const fetchFn of [
      vi.fn().mockResolvedValue(jsonResponse({}, 404)),
      vi.fn().mockRejectedValue(new TypeError('offline')),
      vi.fn().mockResolvedValue(html),
    ]) {
      await expect(loadAppConfig(defaults, base, fetchFn)).resolves.toBe(defaults);
    }
  });

  it('stops the startup when the JSON file is broken', async () => {
    const broken = new Response('{', { headers: { 'content-type': 'application/json' } });
    await expect(loadAppConfig(defaults, base, vi.fn().mockResolvedValue(broken))).rejects.toThrow(
      'El archivo no es JSON válido.',
    );
  });
});
