import {
  checkValue,
  ConfigParameter,
  displayValue,
  formatWeightsTotal,
  issueMessage,
  lowestRole,
  reasonCode,
  reasonLabel,
  sameValue,
  splitIssues,
  weightsSumToOne,
  weightsTotal,
} from './config-model';

function param(overrides: Partial<ConfigParameter>): ConfigParameter {
  return {
    key: 'x',
    group: 'judge',
    type: 'integer',
    default: '0',
    level: 'validated',
    min_role: 'admin',
    description: 'Parámetro',
    min: null,
    max: null,
    validations: [],
    options: [],
    ...overrides,
  };
}

describe('config model', () => {
  it('checks each type and range like the API', () => {
    const threshold = param({ type: 'integer', min: '10', max: '20' });
    expect(checkValue(threshold, '15')).toBeNull();
    expect(checkValue(threshold, '21')).toBe('out_of_range');
    expect(checkValue(threshold, '9')).toBe('out_of_range');
    expect(checkValue(threshold, '12.5')).toBe('invalid_integer');
    expect(checkValue(threshold, '')).toBe('invalid_integer');

    const weight = param({ group: 'formula', type: 'decimal', min: '0', max: '1' });
    expect(checkValue(weight, '0.25')).toBeNull();
    expect(checkValue(weight, '.5')).toBeNull();
    expect(checkValue(weight, '0.12345')).toBe('too_many_decimals');
    expect(checkValue(weight, 'abc')).toBe('invalid_decimal');
    expect(checkValue(weight, '1.5')).toBe('out_of_range');

    expect(checkValue(param({ type: 'boolean' }), 'true')).toBeNull();
    expect(checkValue(param({ type: 'boolean' }), 'yes')).toBe('invalid_boolean');
    expect(checkValue(param({ type: 'enum', options: ['a', 'b'] }), 'c')).toBe('not_an_option');
    expect(checkValue(param({ type: 'string' }), '  ')).toBe('empty');
  });

  it('compares numbers by value and other types by text', () => {
    const decimal = param({ type: 'decimal' });
    expect(sameValue(decimal, '0.30', '0.3')).toBe(true);
    expect(sameValue(decimal, '0.31', '0.3')).toBe(false);
    expect(sameValue(param({ type: 'string' }), 'a', 'a ')).toBe(false);
  });

  it('sums the weights exactly, without float drift', () => {
    const weights = ['S', 'P', 'T', 'A', 'D'].map((factor) =>
      param({ key: `weights.${factor}`, group: 'formula', validations: ['weights_sum_to_one'] }),
    );
    const values: Record<string, string> = {
      'weights.S': '0.25',
      'weights.P': '0.30',
      'weights.T': '0.20',
      'weights.A': '0.15',
      'weights.D': '0.10',
    };
    const total = weightsTotal([...weights, param({ key: 'dead_zone' })], (key) => values[key]);
    expect(weightsSumToOne(total)).toBe(true);
    expect(formatWeightsTotal(total)).toBe('1.00');

    values['weights.S'] = '0.20';
    expect(weightsSumToOne(weightsTotal(weights, (key) => values[key]))).toBe(false);
    values['weights.S'] = 'x';
    expect(weightsTotal(weights, (key) => values[key])).toBeNull();
    expect(weightsTotal([param({ key: 'dead_zone' })], () => '4')).toBeNull();
  });

  it('names the issues of the API in Spanish, with the bounds of the parameter', () => {
    expect(issueMessage('out_of_range', param({ min: '10', max: '20' }))).toBe(
      'Debe estar entre 10 y 20.',
    );
    expect(issueMessage('weights_sum_to_one')).toBe('Los pesos deben sumar exactamente 1.0.');
    expect(issueMessage('levels_not_monotonic')).toContain('de mayor a menor');
    expect(issueMessage('something_new')).toBe('El valor no es válido.');
  });

  it('splits the details per parameter and per rule of the change', () => {
    expect(
      splitIssues([
        { field: 'body.changes.weights.S', issue: 'invalid_decimal' },
        { field: 'body.changes', issue: 'levels_not_monotonic' },
        { field: 'body.expected_version', issue: 'missing' },
      ]),
    ).toEqual({ byKey: { 'weights.S': 'invalid_decimal' }, rules: ['levels_not_monotonic'] });
  });

  it('shows values and reasons for people', () => {
    const profile = param({ key: 'sensitivity_profile', type: 'enum' });
    expect(displayValue(profile, 'minimal')).toBe('Influencia mínima');
    expect(displayValue(profile, 'custom')).toBe('custom');
    expect(displayValue(param({ type: 'boolean' }), 'true')).toBe('Activado');
    expect(displayValue(param({}), undefined)).toBe('—');

    const reason = param({ key: 'reasons.ransomware.enabled', type: 'boolean' });
    expect(reasonCode(reason)).toBe('ransomware');
    expect(reasonLabel(reason)).toBe('Ransomware');
    expect(reasonCode(param({ key: 'reasons.ransomware.enabled', type: 'integer' }))).toBeNull();
    expect(
      reasonLabel(param({ key: 'reasons.new_one.enabled', type: 'boolean', description: 'Nuevo' })),
    ).toBe('Nuevo');
  });

  it('finds the lowest role that can save', () => {
    expect(lowestRole(['admin', 'analyst', 'admin'])).toBe('analyst');
    expect(lowestRole([])).toBeNull();
  });
});
