import type { ConfigParameter } from './config-model';
import { profileCards, profileDeadZone, profileText, profileValues } from './sensitivity-profiles';
import { parameter, SCHEMA } from './testing/config-fixtures';

const PUBLISHED = SCHEMA.find((param) => param.key === 'sensitivity_profile') as ConfigParameter;

/** The profile parameter of a backend before F18.6: the options, without `option_values`. */
const WITHOUT_VALUES = parameter({
  key: 'sensitivity_profile',
  type: 'enum',
  default: 'normal',
  options: ['broad', 'minimal', 'normal'],
});

/** A schema whose values differ from docs/07 §12: the front shows what the schema says, nothing else. */
const RETUNED = parameter({
  key: 'sensitivity_profile',
  type: 'enum',
  default: 'normal',
  options: ['normal', 'strict'],
  option_values: {
    normal: {
      'judge.range_multiplier': '1.2',
      'judge.allow_lowering': 'false',
      dead_zone: ' 5 ',
      'mode2.min_confidence': '0.7',
    },
    strict: { dead_zone: '8' },
  },
});

describe('sensitivity profiles', () => {
  it('reads every value of a profile from the schema when it publishes them', () => {
    expect(profileValues(RETUNED, 'normal')).toEqual({
      'judge.range_multiplier': '1.2',
      'judge.allow_lowering': 'false',
      dead_zone: '5',
      'mode2.min_confidence': '0.7',
    });
    expect(profileDeadZone(RETUNED, 'normal')).toBe('5');
    // A profile the front does not know sets what the schema says.
    expect(profileValues(RETUNED, 'strict')).toEqual({ dead_zone: '8' });
    expect(profileDeadZone(RETUNED, 'strict')).toBe('8');
  });

  it('sets nothing the schema does not publish, never a value of its own', () => {
    // A backend without `option_values`: known profiles get no values, so no dead zone to draft.
    expect(profileValues(WITHOUT_VALUES, 'minimal')).toEqual({});
    expect(profileDeadZone(WITHOUT_VALUES, 'minimal')).toBeNull();
    expect(profileDeadZone(WITHOUT_VALUES, 'broad')).toBeNull();
    expect(profileValues(null, 'broad')).toEqual({});
    // A value the schema leaves out (or sends empty) is left out too; the others come from the schema.
    const partial = parameter({
      key: 'sensitivity_profile',
      type: 'enum',
      options: ['minimal'],
      option_values: { minimal: { dead_zone: '', 'judge.range_multiplier': '0.25' } },
    });
    expect(profileValues(partial, 'minimal')).toEqual({ 'judge.range_multiplier': '0.25' });
    expect(profileDeadZone(partial, 'minimal')).toBeNull();
    expect(profileCards(WITHOUT_VALUES).map(({ text, deadZone }) => ({ text, deadZone }))).toEqual([
      { text: '', deadZone: null },
      { text: '', deadZone: null },
      { text: '', deadZone: null },
    ]);
  });

  it('gives nothing for an unknown profile without values, whatever its name', () => {
    expect(profileValues(WITHOUT_VALUES, 'custom')).toEqual({});
    expect(profileDeadZone(WITHOUT_VALUES, 'custom')).toBeNull();
    expect(profileDeadZone(WITHOUT_VALUES, 'constructor')).toBeNull();
    expect(profileDeadZone(WITHOUT_VALUES, '__proto__')).toBeNull();
  });

  it('describes a profile from its values', () => {
    expect(profileText(profileValues(PUBLISHED, 'minimal'))).toBe(
      'Ajustes más cortos que los rangos de referencia (×0.5). Solo puede subir la puntuación. ' +
        'Modo 2: confianza mínima 0.8, si un admin no fija otra.',
    );
    expect(profileText(profileValues(PUBLISHED, 'normal'))).toBe(
      'Rangos de referencia (×1). Puede bajar la puntuación si hay una fuente N1. ' +
        'Modo 2: confianza mínima 0.6, si un admin no fija otra.',
    );
    expect(profileText(profileValues(PUBLISHED, 'broad'))).toContain('Ajustes más amplios (×1.5).');
    expect(profileText(profileValues(RETUNED, 'normal'))).toContain('Ajustes más amplios (×1.2).');
    // Values it cannot read are left out, never guessed.
    expect(
      profileText({ 'judge.range_multiplier': 'mucho', 'judge.allow_lowering': 'a veces' }),
    ).toBe('');
    expect(profileText({})).toBe('');
  });

  it('builds the cards in display order with the label, the text and the dead zone of each profile', () => {
    expect(
      profileCards(PUBLISHED).map(({ value, label, deadZone }) => ({ value, label, deadZone })),
    ).toEqual([
      { value: 'minimal', label: 'Influencia mínima', deadZone: '6' },
      { value: 'normal', label: 'Normal', deadZone: '4' },
      { value: 'broad', label: 'Influencia amplia', deadZone: '2' },
    ]);
    const retuned = profileCards(RETUNED);
    expect(retuned.map((card) => [card.value, card.deadZone])).toEqual([
      ['normal', '5'],
      ['strict', '8'],
    ]);
    expect(retuned[1].text).toBe('');
    expect(profileCards(null)).toEqual([]);
  });
});
