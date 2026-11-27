import openapi from '../../../../openapi/openapi.json';
import {
  ACCEPT_ORIGINAL,
  acceptOriginalProblem,
  FeedbackDraft,
  FeedbackRequest,
  LevelBands,
  levelOfScore,
  parseLevelBands,
  shiftLevel,
  ticketItopId,
  toFeedbackRequest,
  Verdict,
  VERDICTS,
} from './feedback';
import { BANDS, recommendation, RECOMMENDATION } from './recommendation.fixtures';

type JsonSchema = Record<string, unknown>;

const SCHEMAS = (openapi as unknown as { components: { schemas: Record<string, JsonSchema> } })
  .components.schemas;

const ANNOTATIONS = new Set(['description', 'title', 'examples', 'default']);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasType(type: unknown, value: unknown): boolean {
  switch (type) {
    case 'object':
      return isObject(value);
    case 'string':
      return typeof value === 'string';
    case 'integer':
      return Number.isInteger(value);
    case 'number':
      return typeof value === 'number';
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    case 'array':
      return Array.isArray(value);
    default:
      throw new Error(`Unsupported type: ${String(type)}`);
  }
}

/**
 * The JSON Schema keywords the OpenAPI uses for request bodies, checked against a value. Any other keyword throws,
 * so a schema change the checker does not understand fails the test instead of passing silently.
 */
function schemaErrors(schema: JsonSchema, value: unknown, path = '$'): string[] {
  const errors: string[] = [];
  for (const [keyword, rule] of Object.entries(schema)) {
    if (ANNOTATIONS.has(keyword) || keyword === 'then') continue;
    switch (keyword) {
      case 'type':
        if (!hasType(rule, value)) errors.push(`${path}: not ${String(rule)}`);
        break;
      case 'enum':
        if (!(rule as unknown[]).includes(value)) errors.push(`${path}: not in enum`);
        break;
      case 'const':
        if (value !== rule) errors.push(`${path}: not ${String(rule)}`);
        break;
      case 'anyOf':
        if (!(rule as JsonSchema[]).some((option) => !schemaErrors(option, value, path).length)) {
          errors.push(`${path}: matches no option`);
        }
        break;
      case 'maxLength':
        if (typeof value === 'string' && value.length > (rule as number)) {
          errors.push(`${path}: too long`);
        }
        break;
      case 'pattern':
        if (typeof value === 'string' && !new RegExp(rule as string, 'u').test(value)) {
          errors.push(`${path}: does not match ${String(rule)}`);
        }
        break;
      case 'minimum':
        if (typeof value === 'number' && value < (rule as number)) errors.push(`${path}: too low`);
        break;
      case 'maximum':
        if (typeof value === 'number' && value > (rule as number)) errors.push(`${path}: too high`);
        break;
      case 'properties':
        if (isObject(value)) {
          for (const [name, property] of Object.entries(rule as Record<string, JsonSchema>)) {
            if (name in value)
              errors.push(...schemaErrors(property, value[name], `${path}.${name}`));
          }
        }
        break;
      case 'required':
        if (isObject(value)) {
          for (const name of rule as string[]) {
            if (!(name in value)) errors.push(`${path}.${name}: required`);
          }
        }
        break;
      case 'additionalProperties':
        if (rule === false && isObject(value)) {
          const known = Object.keys((schema['properties'] as JsonSchema | undefined) ?? {});
          for (const name of Object.keys(value)) {
            if (!known.includes(name)) errors.push(`${path}.${name}: not allowed`);
          }
        }
        break;
      case 'if':
        if (!schemaErrors(rule as JsonSchema, value, path).length && schema['then']) {
          errors.push(...schemaErrors(schema['then'] as JsonSchema, value, path));
        }
        break;
      default:
        throw new Error(`Unsupported JSON Schema keyword: ${keyword}`);
    }
  }
  return errors;
}

const feedbackRequestErrors = (value: unknown) => schemaErrors(SCHEMAS['FeedbackRequest'], value);

function draft(changes: Partial<FeedbackDraft>): FeedbackDraft {
  return { choice: null, proposedLevel: null, proposedScore: null, comment: '', ...changes };
}

function request(changes: Partial<FeedbackDraft>, rec = RECOMMENDATION): FeedbackRequest {
  const outcome = toFeedbackRequest(rec, draft(changes), BANDS);
  if (!outcome.ok) throw new Error(outcome.problem);
  return outcome.request;
}

function problem(
  changes: Partial<FeedbackDraft>,
  rec = RECOMMENDATION,
  bands: LevelBands | null = BANDS,
): string {
  const outcome = toFeedbackRequest(rec, draft(changes), bands);
  if (outcome.ok) throw new Error('expected a problem');
  return outcome.problem;
}

describe('feedback payloads against the OpenAPI FeedbackRequest schema', () => {
  it('checker rejects what the schema forbids (it is not vacuous)', () => {
    const valid = { assessment_id: RECOMMENDATION.assessment_id, verdict: 'relevant' };
    expect(feedbackRequestErrors(valid)).toEqual([]);
    expect(feedbackRequestErrors({ ...valid, verdict: 'wrong_priority' })).toContain(
      '$.proposed_level: required',
    );
    expect(feedbackRequestErrors({ ...valid, user: 'ana' })).toContain('$.user: not allowed');
    expect(feedbackRequestErrors({ ...valid, ticket_itop_id: 'R-1234' }).length).toBe(1);
    expect(feedbackRequestErrors({ ...valid, proposed_score: 101 }).length).toBe(1);
    expect(feedbackRequestErrors({ ...valid, proposed_score: 7.5 }).length).toBe(1);
    expect(feedbackRequestErrors({ ...valid, comment: 'x'.repeat(2001) }).length).toBe(1);
    expect(feedbackRequestErrors({ ...valid, verdict: 'approve' }).length).toBe(1);
    expect(feedbackRequestErrors({ verdict: 'relevant' })).toContain('$.assessment_id: required');
  });

  it.each(VERDICTS.filter((verdict) => verdict !== 'wrong_priority'))(
    'sends %s with the ticket on view and the comment',
    (verdict: Verdict) => {
      const body = request({ choice: verdict, comment: '  Revisado con el equipo.  ' });
      expect(body).toEqual({
        assessment_id: RECOMMENDATION.assessment_id,
        verdict,
        ticket_itop_id: '1234',
        comment: 'Revisado con el equipo.',
      });
      expect(feedbackRequestErrors(body)).toEqual([]);
    },
  );

  it('sends wrong_priority with the proposed level and the optional score', () => {
    const withScore = request({
      choice: 'wrong_priority',
      proposedLevel: 'critical',
      proposedScore: 95,
    });
    expect(withScore).toEqual({
      assessment_id: RECOMMENDATION.assessment_id,
      verdict: 'wrong_priority',
      proposed_level: 'critical',
      proposed_score: 95,
      ticket_itop_id: '1234',
    });
    expect(feedbackRequestErrors(withScore)).toEqual([]);

    const levelOnly = request({ choice: 'wrong_priority', proposedLevel: 'medium' });
    expect(levelOnly).not.toHaveProperty('proposed_score');
    expect(feedbackRequestErrors(levelOnly)).toEqual([]);
  });

  it('sends «Aceptar puntaje original» as wrong_priority with the base score and its level (RE-9)', () => {
    const body = request({ choice: ACCEPT_ORIGINAL });
    expect(body).toEqual({
      assessment_id: RECOMMENDATION.assessment_id,
      verdict: 'wrong_priority',
      proposed_level: 'medium',
      proposed_score: 74,
      ticket_itop_id: '1234',
    });
    expect(feedbackRequestErrors(body)).toEqual([]);
  });

  it('leaves the ticket out when the recommendation shows none', () => {
    const body = request({ choice: 'investigating' }, recommendation({ ticket_url: null }));
    expect(body).toEqual({ assessment_id: RECOMMENDATION.assessment_id, verdict: 'investigating' });
    expect(feedbackRequestErrors(body)).toEqual([]);
  });
});

describe('feedback rules', () => {
  it('asks for a verdict', () => {
    expect(problem({})).toBe('Elige un veredicto.');
  });

  it('needs the arrows to move away from the current level with wrong_priority', () => {
    expect(problem({ choice: 'wrong_priority' })).toMatch(/flechas/);
    expect(problem({ choice: 'wrong_priority', proposedLevel: 'high' })).toMatch(/flechas/);
  });

  it('only accepts an integer score from 0 to 100', () => {
    for (const score of [-1, 101, 50.5]) {
      expect(
        problem({ choice: 'wrong_priority', proposedLevel: 'critical', proposedScore: score }),
      ).toMatch(/entero de 0 a 100/);
    }
    expect(request({ choice: 'wrong_priority', proposedLevel: 'low', proposedScore: 0 })).toEqual(
      expect.objectContaining({ proposed_score: 0 }),
    );
  });

  it('limits the comment to 2000 characters', () => {
    expect(problem({ choice: 'relevant', comment: 'x'.repeat(2001) })).toMatch(/2000/);
    expect(request({ choice: 'relevant', comment: '   ' })).not.toHaveProperty('comment');
  });

  it('refuses «Aceptar puntaje original» without a judge adjustment or without the bands', () => {
    const unadjusted = recommendation({ judge_adjustment: 0, final: 74 });
    expect(problem({ choice: ACCEPT_ORIGINAL }, unadjusted)).toMatch(/no ajustó/);
    expect(acceptOriginalProblem(RECOMMENDATION, null)).toMatch(/niveles de la configuración/);
    expect(problem({ choice: ACCEPT_ORIGINAL }, RECOMMENDATION, null)).toMatch(
      /niveles de la configuración/,
    );
    expect(acceptOriginalProblem(RECOMMENDATION, BANDS)).toBeNull();
  });
});

describe('levels and tickets', () => {
  it('reads the level bands of the configuration', () => {
    expect(
      parseLevelBands({ 'bands.1': '90', 'bands.2': '75', 'bands.3': ' 50 ', 'bands.4': '0' }),
    ).toEqual(BANDS);
    expect(parseLevelBands({ 'bands.1': '90', 'bands.2': '75', 'bands.3': '50' })).toBeNull();
    expect(
      parseLevelBands({ 'bands.1': '90', 'bands.2': '7.5', 'bands.3': '50', 'bands.4': '0' }),
    ).toBeNull();
    expect(
      parseLevelBands({ 'bands.1': '190', 'bands.2': '75', 'bands.3': '50', 'bands.4': '0' }),
    ).toBeNull();
  });

  it('gives the level of a score with the bands', () => {
    expect([95, 90, 89, 75, 74, 50, 49, 0].map((score) => levelOfScore(score, BANDS))).toEqual([
      'critical',
      'critical',
      'high',
      'high',
      'medium',
      'medium',
      'low',
      'low',
    ]);
  });

  it('moves one level per click and stops at the ends', () => {
    expect(shiftLevel('high', 'up')).toBe('critical');
    expect(shiftLevel('critical', 'up')).toBe('critical');
    expect(shiftLevel('high', 'down')).toBe('medium');
    expect(shiftLevel('low', 'down')).toBe('low');
  });

  it('reads the iTop ticket id from the ticket link only when it is a plain id', () => {
    expect(ticketItopId(RECOMMENDATION)).toBe('1234');
    expect(ticketItopId({ ticket_url: null })).toBeNull();
    expect(ticketItopId({ ticket_url: 'https://itop.test/pages/UI.php?id=R-12' })).toBeNull();
    expect(ticketItopId({ ticket_url: 'not a url' })).toBeNull();
  });
});
