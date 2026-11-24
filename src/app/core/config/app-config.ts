import { InjectionToken } from '@angular/core';

/** Firebase web config (Firebase console → Project settings). It is public by design: it ships to every browser. */
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

/** Settings the app needs at startup. */
export interface AppConfig {
  production: boolean;
  /** Base URL of the backend API without a trailing slash; '' means the same origin that serves the front. */
  apiBaseUrl: string;
  /** Firebase web config; null leaves login unavailable (the login screen says so). */
  firebase: FirebaseWebConfig | null;
  /** Firebase Auth emulator URL (local development and tests); null talks to the real Firebase project. */
  authEmulatorUrl: string | null;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

/** Optional runtime override served next to index.html (git-ignored: public/runtime-config.json). */
export const RUNTIME_CONFIG_FILE = 'runtime-config.json';

const FIREBASE_REQUIRED = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;
const FIREBASE_OPTIONAL = ['storageBucket', 'messagingSenderId'] as const;
const TOP_LEVEL_KEYS = ['apiBaseUrl', 'firebase', 'authEmulatorUrl'] as const;

/** Raised when runtime-config.json exists but is not valid; the message is shown to the person as is. */
export class RuntimeConfigError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function httpUrl(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new RuntimeConfigError(`${field} debe ser texto.`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RuntimeConfigError(`${field} no es una URL válida.`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new RuntimeConfigError(`${field} debe usar http o https.`);
  }
  if (url.search || url.hash || url.username || url.password) {
    throw new RuntimeConfigError(`${field} no puede llevar usuario, consulta ni fragmento.`);
  }
  return value.replace(/\/+$/, '');
}

function firebaseConfig(value: unknown): FirebaseWebConfig {
  if (!isRecord(value)) throw new RuntimeConfigError('firebase debe ser un objeto.');
  const allowed: readonly string[] = [...FIREBASE_REQUIRED, ...FIREBASE_OPTIONAL];
  const unknownKey = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknownKey) throw new RuntimeConfigError(`firebase.${unknownKey} no es un campo conocido.`);
  for (const key of FIREBASE_REQUIRED) {
    const field = value[key];
    if (typeof field !== 'string' || !field.trim()) {
      throw new RuntimeConfigError(`firebase.${key} es obligatorio.`);
    }
  }
  for (const key of FIREBASE_OPTIONAL) {
    if (value[key] !== undefined && typeof value[key] !== 'string') {
      throw new RuntimeConfigError(`firebase.${key} debe ser texto.`);
    }
  }
  return value as unknown as FirebaseWebConfig;
}

/** Validates a parsed runtime-config.json and merges it over the build defaults. */
export function mergeRuntimeConfig(defaults: AppConfig, raw: unknown): AppConfig {
  if (!isRecord(raw)) throw new RuntimeConfigError('El archivo debe contener un objeto JSON.');
  const allowed: readonly string[] = TOP_LEVEL_KEYS;
  const unknownKey = Object.keys(raw).find((key) => !allowed.includes(key));
  if (unknownKey) throw new RuntimeConfigError(`${unknownKey} no es un campo conocido.`);

  const merged: AppConfig = { ...defaults };
  if (raw['apiBaseUrl'] !== undefined) {
    merged.apiBaseUrl = raw['apiBaseUrl'] === '' ? '' : httpUrl(raw['apiBaseUrl'], 'apiBaseUrl');
  }
  if (raw['firebase'] !== undefined) {
    merged.firebase = raw['firebase'] === null ? null : firebaseConfig(raw['firebase']);
  }
  if (raw['authEmulatorUrl'] !== undefined) {
    merged.authEmulatorUrl =
      raw['authEmulatorUrl'] === null ? null : httpUrl(raw['authEmulatorUrl'], 'authEmulatorUrl');
  }
  return merged;
}

/**
 * Loads the optional runtime override and merges it over the build defaults (src/environments).
 * A missing file is normal: the request fails, answers 404, or the dev server answers its HTML fallback.
 * A JSON file that is not valid stops the startup with a clear message instead of silently using the defaults.
 */
export async function loadAppConfig(
  defaults: AppConfig,
  baseUri: string,
  fetchFn: typeof fetch = fetch,
): Promise<AppConfig> {
  let response: Response;
  try {
    response = await fetchFn(new URL(RUNTIME_CONFIG_FILE, baseUri).toString(), {
      cache: 'no-store',
      credentials: 'same-origin',
    });
  } catch {
    return defaults;
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || !contentType.includes('application/json')) return defaults;
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new RuntimeConfigError('El archivo no es JSON válido.');
  }
  return mergeRuntimeConfig(defaults, raw);
}
