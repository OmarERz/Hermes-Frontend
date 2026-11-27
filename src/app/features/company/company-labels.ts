import type { ApiSchema } from '../../core/api/api-client';

export type CompanyProfile = ApiSchema<'CompanyProfile'>;
export type PeerCompany = ApiSchema<'PeerCompany'>;
export type PeerCompanyInput = ApiSchema<'PeerCompanyInput'>;

/**
 * The backend sector catalog (`sector` table, seeded by `core/db/seeds.py`). The API has no route that lists it
 * yet, so the front keeps the same codes; a code outside this list is still shown (raw) and the API answers 422
 * `unknown_sector` if it does not exist.
 */
export const SECTOR_LABELS: Readonly<Record<string, string>> = {
  transportation: 'Transporte',
  fintech: 'Tecnología financiera',
  retail: 'Comercio',
  healthcare: 'Salud',
  government: 'Gobierno',
};

export const SECTOR_CODES = Object.keys(SECTOR_LABELS);

/** Output languages offered (the API accepts any `xx` or `xx-YY` code; Spanish is the default). */
export const LANGUAGE_LABELS: Readonly<Record<string, string>> = {
  es: 'Español',
  en: 'Inglés',
};

export const LANGUAGE_CODES = Object.keys(LANGUAGE_LABELS);

/** Same rules as the API (`core/configuration/profile.py`). */
export const COUNTRY_PATTERN = /^[A-Z]{2}$/;
export const LANGUAGE_PATTERN = /^[a-z]{2}(-[A-Za-z]{2})?$/;

export function sectorName(code: string): string {
  if (!code) return 'Sin definir';
  return SECTOR_LABELS[code] ?? code;
}

export function languageName(code: string): string {
  return LANGUAGE_LABELS[code] ?? code;
}

let regionNames: Intl.DisplayNames | null | undefined;

/** Spanish name of an ISO 3166 country code («MX» → «México»), or the code if the browser has no name for it. */
export function countryName(code: string): string {
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(['es'], { type: 'region' });
    } catch {
      regionNames = null;
    }
  }
  if (!regionNames || !COUNTRY_PATTERN.test(code)) return code;
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** «México (MX), Colombia (CO)», or the given text when the list is empty. */
export function countryList(codes: readonly string[], empty = 'Ninguno'): string {
  return codes.length ? codes.map((code) => `${countryName(code)} (${code})`).join(', ') : empty;
}

export function sectorList(codes: readonly string[], empty = 'Ninguno'): string {
  return codes.length ? codes.map(sectorName).join(', ') : empty;
}
