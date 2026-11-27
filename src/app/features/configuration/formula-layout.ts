import type { ConfigParameter } from './config-model';

/**
 * How the formula parameters of the schema (`weights.<factor>`, `levels.<factor>.<code>`, `bands.<urgency>`,
 * `decay.<step>.<field>`, `formula.<name>`) are laid out and named on the Fórmula screen. Every parameter comes
 * from the schema: names are only labels, and a key this file does not know keeps its schema description.
 */

const FACTOR_ORDER = ['S', 'P', 'T', 'A', 'D', 'E'];
const FACTOR_NAMES: Record<string, string> = {
  S: 'Severidad',
  P: 'Explotación',
  T: 'Contexto de amenaza',
  A: 'Activo',
  D: 'Sensibilidad de los datos',
  E: 'Confirmación de versión (alertas sin hallazgo)',
};

/** Levels of docs/06 §3 by rank, strongest first (the order the API validates as monotonic). */
const LEVEL_NAMES: Record<string, [code: string, name: string][]> = {
  P: [
    ['kev_or_exploited', 'En KEV o explotada'],
    ['public_poc', 'PoC o exploit público'],
    ['epss_p90', 'EPSS en el percentil 90 o más'],
    ['other', 'Otro caso'],
  ],
  T: [
    ['peer_exploited_with_vector', 'Par explotado con un vector de su stack'],
    ['peer_attacked', 'Par nombrado atacado'],
    ['sector_region_with_vector', 'Sector y región con un vector del stack'],
    ['trend_4_or_more_sources', 'Tendencia: 4 o más fuentes'],
    ['sector_region', 'Mismo sector y región'],
    ['trend_2_to_3_sources', 'Tendencia: 2 a 3 fuentes'],
    ['sector_only', 'Solo mismo sector'],
    ['trend_1_source', 'Tendencia: 1 fuente'],
    ['no_news', 'Sin noticias'],
  ],
  A: [
    ['critical_exposed', 'Crítico y expuesto'],
    ['critical_internal_or_normal_exposed', 'Crítico interno o normal expuesto'],
    ['normal_internal_or_unknown', 'Normal interno o sin criticidad'],
    ['low', 'Bajo'],
  ],
  D: [
    ['highly_classified', 'Ultra clasificada'],
    ['classified', 'Clasificada'],
    ['unclassified', 'Sin clasificar'],
    ['public', 'Pública'],
    ['personal_data_bonus', 'Bono por datos personales (Privada)'],
  ],
  E: [
    ['version_confirmed', 'Versión confirmada'],
    ['version_unknown', 'Versión desconocida'],
  ],
};
const BAND_NAMES: Record<string, string> = {
  '1': 'Crítica',
  '2': 'Alta',
  '3': 'Media',
  '4': 'Baja',
};
const SCALAR_NAMES: Record<string, string> = {
  'formula.s_without_cvss': 'S sin CVSS',
  'formula.kev_exposed_floor': 'Piso KEV + expuesto',
};
const DECAY_FIELDS: Record<string, string> = {
  max_age_days: 'Hasta (días de antigüedad)',
  multiplier: 'Multiplicador',
};

export interface FactorLevels {
  factor: string;
  name: string;
  parameters: ConfigParameter[];
}

export interface DecayStep {
  step: number;
  open: boolean;
  parameters: ConfigParameter[];
}

export interface FormulaLayout {
  weights: ConfigParameter[];
  bands: ConfigParameter[];
  levels: FactorLevels[];
  decay: DecayStep[];
  others: ConfigParameter[];
}

function rank<T>(order: readonly T[], value: T): number {
  const index = order.indexOf(value);
  return index < 0 ? order.length : index;
}

function levelRank(factor: string, code: string): number {
  return rank(
    (LEVEL_NAMES[factor] ?? []).map(([known]) => known),
    code,
  );
}

/** Groups the formula parameters of the schema into the cards of the screen, in the documented order. */
export function formulaLayout(parameters: readonly ConfigParameter[]): FormulaLayout {
  const layout: FormulaLayout = { weights: [], bands: [], levels: [], decay: [], others: [] };
  const levels = new Map<string, ConfigParameter[]>();
  const decay = new Map<number, ConfigParameter[]>();
  for (const param of parameters) {
    const parts = param.key.split('.');
    if (parts[0] === 'weights' && parts.length === 2) layout.weights.push(param);
    else if (parts[0] === 'bands' && parts.length === 2) layout.bands.push(param);
    else if (parts[0] === 'levels' && parts.length === 3) {
      levels.set(parts[1], [...(levels.get(parts[1]) ?? []), param]);
    } else if (parts[0] === 'decay' && parts.length === 3 && Number.isInteger(Number(parts[1]))) {
      const step = Number(parts[1]);
      decay.set(step, [...(decay.get(step) ?? []), param]);
    } else layout.others.push(param);
  }
  layout.weights.sort(
    (a, b) => rank(FACTOR_ORDER, a.key.split('.')[1]) - rank(FACTOR_ORDER, b.key.split('.')[1]),
  );
  layout.bands.sort((a, b) => Number(a.key.split('.')[1]) - Number(b.key.split('.')[1]));
  layout.levels = [...levels.entries()]
    .sort(([a], [b]) => rank(FACTOR_ORDER, a) - rank(FACTOR_ORDER, b) || a.localeCompare(b))
    .map(([factor, list]) => ({
      factor,
      name: FACTOR_NAMES[factor] ? `${factor} · ${FACTOR_NAMES[factor]}` : factor,
      parameters: [...list].sort(
        (a, b) =>
          levelRank(factor, a.key.split('.')[2]) - levelRank(factor, b.key.split('.')[2]) ||
          a.key.localeCompare(b.key),
      ),
    }));
  layout.decay = [...decay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([step, list]) => ({
      step,
      open: !list.some((param) => param.key.endsWith('.max_age_days')),
      parameters: [...list].sort((a, b) => a.key.localeCompare(b.key)),
    }));
  return layout;
}

/** Short name inside its card ("En KEV o explotada", "Multiplicador", "Crítica"…). */
export function shortFormulaLabel(param: ConfigParameter): string {
  const parts = param.key.split('.');
  if (parts[0] === 'weights' && parts.length === 2) {
    const name = FACTOR_NAMES[parts[1]];
    return name ? `${parts[1]} · ${name}` : param.description;
  }
  if (parts[0] === 'levels' && parts.length === 3) {
    const found = (LEVEL_NAMES[parts[1]] ?? []).find(([code]) => code === parts[2]);
    return found ? found[1] : param.description;
  }
  if (parts[0] === 'bands' && parts.length === 2) {
    return BAND_NAMES[parts[1]] ? `${BAND_NAMES[parts[1]]}: puntuación mínima` : param.description;
  }
  if (parts[0] === 'decay' && parts.length === 3) {
    return DECAY_FIELDS[parts[2]] ?? param.description;
  }
  return SCALAR_NAMES[param.key] ?? param.description;
}

/** Full name, for the before/after confirmation ("Nivel P · En KEV o explotada"…). */
export function formulaLabel(param: ConfigParameter): string {
  const parts = param.key.split('.');
  const short = shortFormulaLabel(param);
  if (short === param.description) return short;
  if (parts[0] === 'weights') return `Peso ${short}`;
  if (parts[0] === 'levels') return `Nivel ${parts[1]} · ${short}`;
  if (parts[0] === 'bands') return `Banda ${short}`;
  if (parts[0] === 'decay') return `Decaimiento, paso ${parts[1]}: ${short.toLowerCase()}`;
  return short;
}
