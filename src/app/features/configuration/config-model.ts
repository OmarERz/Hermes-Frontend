import type { ApiSchema } from '../../core/api/api-client';
import type { ApiErrorDetail } from '../../core/api/api-error';
import type { Role } from '../../core/api/api-types';
import { LEVEL_LABELS, type Level } from '../../shared/labels';

/** Types of the configuration contract (`GET /api/config/schema`, `GET /api/config`, API-05). */
export type ConfigParameter = ApiSchema<'ConfigParameter'>;
export type ConfigDocument = ApiSchema<'ConfigDocument'>;
export type ConfigVersion = ApiSchema<'ConfigVersion'>;
export type SimulationResult = ApiSchema<'SimulationResult'>;
export type CalibrationProposal = ApiSchema<'CalibrationProposal'>;

/** Parameter changes as the API takes them: key -> new value, as text. */
export type ConfigChanges = Record<string, string>;

/**
 * Outcome of `POST /api/formula/simulate` for a draft: the preview (null when nothing in the draft can be
 * simulated) and the keys that have no preview (FRO-04: `not_simulable`, or the keys an older API refuses).
 */
export interface SimulationOutcome {
  result: SimulationResult | null;
  notSimulable: string[];
}

const RANK: Record<Role, number> = { reader: 0, analyst: 1, admin: 2 };

/** The lowest role among the given ones (the role that can save at least one parameter of a screen). */
export function lowestRole(roles: readonly Role[]): Role | null {
  return roles.reduce<Role | null>(
    (lowest, role) => (lowest === null || RANK[role] < RANK[lowest] ? role : lowest),
    null,
  );
}

// --- values --------------------------------------------------------------------------------------------------

function isNumeric(param: ConfigParameter): boolean {
  return param.type === 'decimal' || param.type === 'integer';
}

/** True when two texts are the same value of the parameter ("0.30" and "0.3" are the same decimal). */
export function sameValue(param: ConfigParameter, a: string, b: string): boolean {
  if (isNumeric(param) && a.trim() !== '' && b.trim() !== '') {
    const left = Number(a);
    const right = Number(b);
    if (Number.isFinite(left) && Number.isFinite(right)) return left === right;
  }
  return a === b;
}

const INTEGER = /^-?\d+$/;
const DECIMAL = /^-?(\d+(\.\d*)?|\.\d+)$/;
/** The formula is stored as numeric(5,4): more decimal places would be rounded away (the API refuses them). */
const FORMULA_DECIMALS = 4;

/**
 * Client-side check of one value, the same rules the API repeats (FRONTEND.md §5): type, range and, for the
 * formula, at most 4 decimal places. Returns the API issue code, or null when the value is valid.
 */
export function checkValue(param: ConfigParameter, raw: string): string | null {
  const text = raw.trim();
  switch (param.type) {
    case 'boolean':
      return raw === 'true' || raw === 'false' ? null : 'invalid_boolean';
    case 'enum':
      return (param.options ?? []).includes(raw) ? null : 'not_an_option';
    case 'string':
      return text ? null : 'empty';
    case 'integer':
      if (!INTEGER.test(text)) return 'invalid_integer';
      break;
    case 'decimal':
      if (!DECIMAL.test(text)) return 'invalid_decimal';
      if (param.group === 'formula' && (text.split('.')[1] ?? '').length > FORMULA_DECIMALS) {
        return 'too_many_decimals';
      }
      break;
  }
  const value = Number(text);
  if (param.min !== null && param.min !== undefined && value < Number(param.min)) {
    return 'out_of_range';
  }
  if (param.max !== null && param.max !== undefined && value > Number(param.max)) {
    return 'out_of_range';
  }
  return null;
}

/** Rule of the schema (`validations`) that the weights must sum to exactly 1.0. */
export const WEIGHTS_RULE = 'weights_sum_to_one';
const SCALE = 10 ** FORMULA_DECIMALS;

/**
 * Sum of the parameters that carry the weights rule, in exact units of 0.0001 (no float drift), or null when the
 * screen has none or one of them is not a number yet (its own field shows the error).
 */
export function weightsTotal(
  parameters: readonly ConfigParameter[],
  valueOf: (key: string) => string,
): number | null {
  const weights = parameters.filter((param) => (param.validations ?? []).includes(WEIGHTS_RULE));
  if (!weights.length) return null;
  let total = 0;
  for (const param of weights) {
    const value = Number(valueOf(param.key));
    if (valueOf(param.key).trim() === '' || !Number.isFinite(value)) return null;
    total += Math.round(value * SCALE);
  }
  return total;
}

export function weightsSumToOne(total: number | null): boolean {
  return total === null || total === SCALE;
}

export function formatWeightsTotal(total: number | null): string {
  return total === null ? '—' : (total / SCALE).toFixed(2);
}

// --- messages --------------------------------------------------------------------------------------------------

/** Spanish text of each validation issue of the API (`details[].issue`) for the person editing. */
const ISSUE_MESSAGES: Record<string, string> = {
  weights_sum_to_one: 'Los pesos deben sumar exactamente 1.0.',
  weight_out_of_range: 'Cada peso debe estar entre 0 y 1.',
  levels_not_monotonic:
    'Los niveles de cada factor deben ir de mayor a menor (por ejemplo, KEV ≥ PoC ≥ EPSS ≥ otro).',
  level_out_of_range: 'Cada nivel debe estar entre 0 y 1.',
  decay_not_decreasing:
    'El decaimiento debe ir decreciendo: plazos crecientes y multiplicadores menores entre 0 y 1.',
  bands_not_ordered:
    'Las bandas deben quedar ordenadas (Crítica > Alta > Media > Baja) y la banda Baja debe empezar en 0.',
  s_without_cvss_out_of_range: 'S sin CVSS debe estar entre 0.5 y 1.0.',
  floor_out_of_range: 'El piso KEV + expuesto debe estar entre 80 y 100.',
  dead_zone_out_of_range: 'La zona muerta debe estar entre 0 y 10.',
  formula_invalid: 'La fórmula no es válida.',
  invalid_decimal: 'Escribe un número válido.',
  invalid_number: 'Escribe un número válido.',
  invalid_integer: 'Escribe un número entero.',
  too_many_decimals: 'Usa como máximo 4 decimales.',
  invalid_boolean: 'Elige activado o desactivado.',
  not_an_option: 'Elige una de las opciones.',
  empty: 'Escribe un valor.',
  invalid_json: 'El valor no tiene un formato válido.',
  unknown_parameter: 'El servidor no reconoce este parámetro.',
  requires_admin: 'Solo un administrador puede cambiar este parámetro.',
  requires_analyst: 'Se necesita el rol de analista para cambiar este parámetro.',
  text_too_long: 'El texto es demasiado largo.',
};

/** The message for an issue; `out_of_range` names the bounds of the parameter when it has them. */
export function issueMessage(issue: string, param?: ConfigParameter): string {
  if (issue === 'out_of_range' || issue === 'less_than_equal' || issue === 'greater_than_equal') {
    const min = param?.min;
    const max = param?.max;
    if (min !== null && min !== undefined && max !== null && max !== undefined) {
      return `Debe estar entre ${min} y ${max}.`;
    }
    if (min !== null && min !== undefined) return `Debe ser al menos ${min}.`;
    if (max !== null && max !== undefined) return `Debe ser como máximo ${max}.`;
    return 'El valor está fuera del rango permitido.';
  }
  return ISSUE_MESSAGES[issue] ?? 'El valor no es válido.';
}

const CHANGE_FIELD = 'body.changes.';

/**
 * Splits the `details` of a 422 (or 403) of the configuration routes: per parameter (`body.changes.<key>`) and
 * the rules of the whole change (`body.changes`, such as `weights_sum_to_one`).
 */
export function splitIssues(details: readonly ApiErrorDetail[]): {
  byKey: Record<string, string>;
  rules: string[];
} {
  const byKey: Record<string, string> = {};
  const rules: string[] = [];
  for (const { field, issue } of details) {
    if (field.startsWith(CHANGE_FIELD)) byKey[field.slice(CHANGE_FIELD.length)] = issue;
    else if (field === 'body.changes') rules.push(issue);
  }
  return { byKey, rules };
}

// --- labels --------------------------------------------------------------------------------------------------

/** Spanish names of the options of the enum parameters the API publishes today; others show their code. */
const OPTION_LABELS: Record<string, Record<string, string>> = {
  sensitivity_profile: {
    minimal: 'Influencia mínima',
    normal: 'Normal',
    broad: 'Influencia amplia',
  },
  'notifications.consumer': { log: 'Registro (log)', slack: 'Slack' },
};

export function optionLabel(key: string, option: string): string {
  return OPTION_LABELS[key]?.[option] ?? option;
}

/** A value as people read it (Activado/Desactivado, the option name, or the text itself). */
export function displayValue(param: ConfigParameter, raw: string | undefined): string {
  if (raw === undefined || raw === '') return '—';
  if (param.type === 'boolean') {
    if (raw === 'true') return 'Activado';
    return raw === 'false' ? 'Desactivado' : raw;
  }
  if (param.type === 'enum') return optionLabel(param.key, raw);
  return raw;
}

/** Spanish names of the parameter groups of the API; an unknown group shows its code. */
const GROUP_LABELS: Record<string, string> = {
  formula: 'Fórmula',
  judge: 'Juez',
  analysts: 'Analistas',
  notifications: 'Notificaciones',
  scan: 'Escaneo',
  correlation: 'Correlación',
  ingestion: 'Ingesta de noticias',
  llm: 'Modelos de lenguaje',
  budget: 'Presupuesto',
  calibration: 'Calibración',
  sources: 'Fuentes',
  tickets: 'Tickets',
  retention: 'Retención',
};

export function groupLabel(group: string): string {
  return GROUP_LABELS[group] ?? group;
}

/** Judge reason toggles of FRO-03 (`reasons.<code>.enabled`, boolean), when the API publishes them. */
const REASON_KEY = /^reasons\.([a-z0-9_]+)\.enabled$/;

export function reasonCode(param: ConfigParameter): string | null {
  if (param.type !== 'boolean') return null;
  return REASON_KEY.exec(param.key)?.[1] ?? null;
}

/** Names of the judge reasons of docs/07 §5 (the catalog of the API); an unknown code uses its description. */
const REASON_LABELS: Record<string, string> = {
  mass_exploitation: 'Explotación masiva',
  ransomware: 'Ransomware',
  zero_day: 'Día cero',
  more_critical_asset: 'Activo más crítico',
  exploit_chain: 'Cadena de explotación',
  requires_authentication: 'Requiere autenticación',
  missing_configuration: 'Falta la configuración vulnerable',
  unverified_poc: 'PoC no verificada',
  other: 'Otro motivo',
};

export function reasonLabel(param: ConfigParameter): string {
  const code = reasonCode(param);
  return (code && REASON_LABELS[code]) || param.description;
}

/** Spanish label of a level of the simulation (`critical`, `high`…); unknown levels show their code. */
export function levelLabel(level: string): string {
  return LEVEL_LABELS[level as Level] ?? level;
}

/**
 * The protections that no route of the API can change (FRO-01, docs/13 §2), shown with 🔒 and never as a
 * control: they are text, not parameters.
 */
export const LOCKED_PROTECTIONS: readonly { code: string; name: string; effect: string }[] = [
  {
    code: 'L5',
    name: 'Cita textual',
    effect: 'Cada motivo del juez cita una frase real de la evidencia.',
  },
  {
    code: 'L6',
    name: 'Asimetría de fuentes',
    effect: 'Para bajar una puntuación se necesita una fuente N1.',
  },
  {
    code: 'L7',
    name: 'Esquema cerrado',
    effect: 'El juez solo responde con herramientas validadas.',
  },
  {
    code: 'L8',
    name: 'Juez sin acciones',
    effect: 'Solo el backend escribe en iTop y en Slack; el juez nunca ejecuta acciones.',
  },
  { code: 'L11', name: 'Respaldo', effect: 'Si el juez falla, la final es igual a la base.' },
  {
    code: 'SEG-02/03',
    name: 'Contenido externo como datos',
    effect: 'Las noticias van delimitadas y se marcan si traen instrucciones.',
  },
  {
    code: 'EVA',
    name: 'Estructura de la fórmula',
    effect:
      'Suma ponderada de S, P, T, A y D con aritmética decimal y redondeo mitad hacia arriba.',
  },
  {
    code: 'NOT-03',
    name: 'Entrega inmediata de lo crítico',
    effect: 'Los eventos inmediatos no esperan al resumen.',
  },
];
