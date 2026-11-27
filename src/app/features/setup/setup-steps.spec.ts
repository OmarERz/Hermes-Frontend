import {
  canUnmark,
  firstOpenStep,
  markNotice,
  nextOpenStep,
  SetupStep,
  stateText,
  STEP_GUIDES,
  stepGuide,
  stepState,
} from './setup-steps';

const step = (n: number, done = false, skipped = false): SetupStep => ({
  n,
  name: `Paso ${n}`,
  done,
  skipped,
});

describe('setup steps', () => {
  it('reads each step as done, skipped or pending, done first', () => {
    expect(stepState({ done: true, skipped: true })).toBe('done');
    expect(stepState({ done: false, skipped: true })).toBe('skipped');
    expect(stepState({ done: false, skipped: false })).toBe('pending');
  });

  it('opens on the first pending step, or the first step when none is pending', () => {
    expect(firstOpenStep([step(1, true), step(2, false, true), step(3)])).toBe(3);
    expect(firstOpenStep([step(1, true), step(2, false, true)])).toBe(1);
    expect(firstOpenStep([])).toBeNull();
  });

  it('moves on to the next pending step, wrapping to the start', () => {
    const steps = [step(1), step(2, true), step(3), step(4, false, true)];
    expect(nextOpenStep(steps, 1)).toBe(3);
    expect(nextOpenStep(steps, 3)).toBe(1);
    expect(nextOpenStep([step(1, true), step(2)], 2)).toBeNull();
  });

  it('says what happened after a mark', () => {
    expect(markNotice(step(2, true), 'done')).toBe('«Paso 2» quedó como hecho.');
    expect(markNotice(step(3, false, true), 'skipped')).toBe(
      'Se omitió «Paso 3». La similitud con las víctimas (R3) solo usa el sector.',
    );
    // A skip the data already overrides reads as done.
    expect(markNotice(step(5, true), 'skipped')).toBe('«Paso 5» quedó como hecho.');
    expect(markNotice(step(4), 'reset')).toBe('«Paso 4» volvió a quedar pendiente.');
    // Taking back a mark the data meanwhile backs leaves the step done.
    expect(markNotice({ ...step(4, true), done_source: 'data' }, 'reset')).toBe(
      '«Paso 4» sigue hecho: los datos ya lo muestran.',
    );
  });

  it('says where a done step comes from, and lets only a manual mark be taken back', () => {
    expect(stateText({ done: true, skipped: false, done_source: 'data' })).toBe(
      'Hecho · detectado',
    );
    expect(stateText({ done: true, skipped: false, done_source: 'manual' })).toBe(
      'Hecho · marcado',
    );
    // Without `done_source` (a backend before F18.6), or for a step not done, only the state.
    expect(stateText({ done: true, skipped: false })).toBe('Hecho');
    expect(stateText({ done: false, skipped: true, done_source: 'manual' })).toBe('Omitido');
    expect(stateText({ done: false, skipped: false, done_source: null })).toBe('Pendiente');

    expect(canUnmark({ done: true, done_source: 'manual' })).toBe(true);
    expect(canUnmark({ done: true, done_source: 'data' })).toBe(false);
    expect(canUnmark({ done: true })).toBe(false);
    expect(canUnmark({ done: false, done_source: 'manual' })).toBe(false);
  });

  it('guides the seven steps of docs/13 §9 and still shows a step it does not know', () => {
    expect(Object.keys(STEP_GUIDES)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(stepGuide(1).what).toContain('no se captura ninguna llave');
    expect(stepGuide(6).links.map((link) => link.path)).toEqual([
      '/configuracion-agente',
      '/formula',
    ]);
    expect(stepGuide(8)).toEqual(
      expect.objectContaining({ links: [], ifSkipped: 'Queda como pendiente.' }),
    );
  });
});
