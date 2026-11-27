import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { ApiClient } from '../../core/api/api-client';
import { ApiError } from '../../core/api/api-error';
import { ConfigApi } from './config-api';
import type { SimulationResult } from './config-model';

const RESULT: SimulationResult = {
  changed_findings: 2,
  level_matrix: { high: { critical: 1, high: 4 } },
  last_30_days_effect: '2 de 15 hallazgos abiertos cambiarían de nivel con la fórmula propuesta.',
  top_movers: ['CVE-2026-10001 en srv-pagos-01: 70 a 82'],
};

function refused(...keys: string[]) {
  return new ApiError(
    422,
    'validation_error',
    'Solo los parámetros de la fórmula se pueden simular.',
    keys.map((key) => ({ field: `body.changes.${key}`, issue: 'unknown_parameter' })),
  );
}

function setup() {
  const client = { get: vi.fn(), post: vi.fn(), put: vi.fn() };
  TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: client }] });
  return { client, api: TestBed.inject(ConfigApi) };
}

const FORMULA = new Set(['weights.S', 'weights.P']);

describe('ConfigApi', () => {
  it('reads not_simulable from an extended simulation', async () => {
    const { client, api } = setup();
    client.post.mockReturnValue(of({ ...RESULT, not_simulable: ['judge.max_calls'] }));
    const outcome = await firstValueFrom(
      api.simulate({ 'weights.S': '0.30', 'judge.max_calls': '9' }, FORMULA),
    );
    expect(outcome).toEqual({
      result: { ...RESULT, not_simulable: ['judge.max_calls'] },
      notSimulable: ['judge.max_calls'],
    });
    expect(client.post).toHaveBeenCalledWith('/api/formula/simulate', {
      body: { changes: { 'weights.S': '0.30', 'judge.max_calls': '9' } },
    });
  });

  it('simulates only the formula part when an older API refuses the other keys', async () => {
    const { client, api } = setup();
    client.post
      .mockReturnValueOnce(throwError(() => refused('sensitivity_profile')))
      .mockReturnValueOnce(of(RESULT));
    const outcome = await firstValueFrom(
      api.simulate({ 'weights.S': '0.30', sensitivity_profile: 'broad' }, FORMULA),
    );
    expect(outcome).toEqual({ result: RESULT, notSimulable: ['sensitivity_profile'] });
    expect(client.post).toHaveBeenLastCalledWith('/api/formula/simulate', {
      body: { changes: { 'weights.S': '0.30' } },
    });
  });

  it('answers no preview when nothing of the draft can be simulated', async () => {
    const { client, api } = setup();
    client.post.mockReturnValue(throwError(() => refused('dead_zone', 'sensitivity_profile')));
    const outcome = await firstValueFrom(
      api.simulate({ dead_zone: '3', sensitivity_profile: 'broad' }, FORMULA),
    );
    expect(outcome).toEqual({ result: null, notSimulable: ['dead_zone', 'sensitivity_profile'] });
    expect(client.post).toHaveBeenCalledTimes(1);
  });

  it('keeps a real validation error of the formula', async () => {
    const { client, api } = setup();
    const invalid = new ApiError(422, 'validation_error', 'La fórmula no es válida.', [
      { field: 'body.changes', issue: 'weights_sum_to_one' },
    ]);
    client.post.mockReturnValue(throwError(() => invalid));
    await expect(firstValueFrom(api.simulate({ 'weights.S': '0.9' }, FORMULA))).rejects.toBe(
      invalid,
    );
    const unknownFormulaKey = refused('weights.S');
    client.post.mockReturnValue(throwError(() => unknownFormulaKey));
    await expect(firstValueFrom(api.simulate({ 'weights.S': '0.9' }, FORMULA))).rejects.toBe(
      unknownFormulaKey,
    );
  });

  it('sends the version read with every versioned write', () => {
    const { client, api } = setup();
    client.put.mockReturnValue(of({ version: 8, values: {} }));
    client.post.mockReturnValue(of({ version: 9, values: {} }));
    api.update({ dead_zone: '3' }, 7).subscribe();
    api.restore(3, 8).subscribe();
    expect(client.put).toHaveBeenCalledWith('/api/config', {
      body: { changes: { dead_zone: '3' }, expected_version: 7 },
    });
    expect(client.post).toHaveBeenCalledWith('/api/config/versions/{v}/restore', {
      path: { v: 3 },
      body: { expected_version: 8 },
    });
  });

  it('maps the pages of versions and proposals to cursor pages', async () => {
    const { client, api } = setup();
    client.get.mockReturnValue(of({ items: [], next_cursor: 'n.sig' }));
    expect(await firstValueFrom(api.versions(null, 10))).toEqual({
      items: [],
      nextCursor: 'n.sig',
    });
    client.get.mockReturnValue(of({ items: [] }));
    expect(await firstValueFrom(api.proposals('a.b', 10))).toEqual({ items: [], nextCursor: null });
    expect(client.get).toHaveBeenLastCalledWith('/api/calibration/proposals', {
      query: { cursor: 'a.b', limit: 10 },
    });
  });
});
