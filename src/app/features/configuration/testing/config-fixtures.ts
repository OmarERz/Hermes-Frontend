import type { ConfigDocument, ConfigParameter } from '../config-model';

/** Test data of the configuration screens, in the shape of `GET /api/config/schema` and `GET /api/config`. */
export function parameter(overrides: Partial<ConfigParameter> & { key: string }): ConfigParameter {
  return {
    group: 'judge',
    type: 'integer',
    default: '0',
    level: 'validated',
    min_role: 'admin',
    description: overrides.key,
    min: null,
    max: null,
    validations: [],
    options: [],
    ...overrides,
  };
}

const WEIGHTS: [string, string][] = [
  ['A', '0.15'],
  ['D', '0.10'],
  ['P', '0.30'],
  ['S', '0.25'],
  ['T', '0.20'],
];

/** The catalog sorted like the API: formula first, then by group and key. */
export const SCHEMA: ConfigParameter[] = [
  parameter({
    key: 'bands.1',
    group: 'formula',
    default: '90',
    min: '0',
    max: '100',
    description: 'Puntuación mínima de la urgencia 1 (1 crítica, 4 baja)',
    validations: ['formula_rules'],
  }),
  parameter({
    key: 'bands.2',
    group: 'formula',
    default: '75',
    min: '0',
    max: '100',
    description: 'Puntuación mínima de la urgencia 2 (1 crítica, 4 baja)',
    validations: ['formula_rules'],
  }),
  parameter({
    key: 'decay.1.max_age_days',
    group: 'formula',
    default: '7',
    min: '0',
    description: 'Paso 1.max_age_days del decaimiento de la amenaza por antigüedad',
    validations: ['formula_rules'],
  }),
  parameter({
    key: 'decay.1.multiplier',
    group: 'formula',
    type: 'decimal',
    default: '1.0',
    min: '0',
    max: '1',
    description: 'Paso 1.multiplier del decaimiento de la amenaza por antigüedad',
    validations: ['formula_rules'],
  }),
  parameter({
    key: 'formula.kev_exposed_floor',
    group: 'formula',
    default: '90',
    min: '80',
    max: '100',
    description: 'Parámetro de la fórmula: kev_exposed_floor',
    validations: ['formula_rules'],
  }),
  parameter({
    key: 'levels.P.kev_or_exploited',
    group: 'formula',
    type: 'decimal',
    default: '1.0',
    min: '0',
    max: '1',
    description: 'Valor del nivel P.kev_or_exploited (de 0 a 1, de más fuerte a más débil)',
    validations: ['formula_rules'],
  }),
  parameter({
    key: 'levels.P.public_poc',
    group: 'formula',
    type: 'decimal',
    default: '0.75',
    min: '0',
    max: '1',
    description: 'Valor del nivel P.public_poc (de 0 a 1, de más fuerte a más débil)',
    validations: ['formula_rules'],
  }),
  ...WEIGHTS.map(([factor, value]) =>
    parameter({
      key: `weights.${factor}`,
      group: 'formula',
      type: 'decimal',
      default: value,
      min: '0',
      max: '1',
      description: `Peso del factor ${factor} en la puntuación base`,
      validations: ['weights_sum_to_one'],
    }),
  ),
  parameter({
    key: 'daily_budget_usd',
    group: 'budget',
    type: 'decimal',
    default: '5',
    min: '0',
    max: '1000',
    description: 'Presupuesto diario (USD)',
  }),
  parameter({
    key: 'complex_reasoning_mode',
    type: 'boolean',
    default: 'false',
    description: 'Modo de razonamiento',
  }),
  parameter({
    key: 'dead_zone',
    default: '4',
    min: '0',
    max: '10',
    description: 'Zona muerta del ajuste del juez',
  }),
  parameter({
    key: 'double_review_threshold',
    default: '15',
    min: '10',
    max: '20',
    description: 'Umbral de doble revisión',
  }),
  parameter({
    key: 'sensitivity_profile',
    type: 'enum',
    default: 'normal',
    options: ['broad', 'minimal', 'normal'],
    description: 'Perfil de sensibilidad del juez',
  }),
  parameter({
    key: 'human_ticket_suggestions',
    group: 'tickets',
    type: 'boolean',
    default: 'true',
    level: 'free',
    min_role: 'analyst',
    description: 'Sugerencias en tickets humanos',
  }),
  parameter({
    key: 'notifications.consumer',
    group: 'notifications',
    type: 'enum',
    default: 'log',
    options: ['log', 'slack'],
    description: 'Consumidor',
  }),
];

export function configDocument(
  version = 7,
  overrides: Record<string, string> = {},
): ConfigDocument {
  const values: Record<string, string> = {};
  for (const param of SCHEMA) values[param.key] = param.default;
  return { version, values: { ...values, ...overrides } };
}
