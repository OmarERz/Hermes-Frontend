import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { provideFakeSession } from '../../testing/fake-session';
import { ComparisonPage } from './comparison.page';
import { ComparisonService, ComparisonSummary } from './comparison.service';

const SUMMARY: ComparisonSummary = {
  reclassification_matrix: {
    critical: { critical: 1, high: 0, medium: 0, low: 0 },
    high: { critical: 2, high: 3, medium: 0, low: 0 },
    medium: { critical: 0, high: 0, medium: 4, low: 1 },
    low: { critical: 0, high: 0, medium: 0, low: 5 },
  },
  funnel: { raw: 40, groups: 20, with_threat_context: 8, judge_adjusted: 5, high_or_critical: 6 },
  reclassified_percent: '18.8',
  hidden_criticals: 2,
  avoided_noise: 1,
  rank_correlation: '0.71',
};

class FakeService {
  summary = vi.fn<ComparisonService['summary']>(() => of(SUMMARY));
  rows = vi.fn<ComparisonService['rows']>(() =>
    of({
      items: [
        {
          cve: 'CVE-2026-10002',
          product: 'nginx',
          ci_id: 'SRV-03',
          cvss: '9.8',
          raw: 98,
          base: 40,
          judge_adjustment: -2,
          final: 38,
          delta: -60,
          main_cause: 'Criticidad y exposición del activo (-45)',
        },
      ],
      nextCursor: null,
    }),
  );
}

async function render(service: FakeService) {
  TestBed.configureTestingModule({
    imports: [ComparisonPage],
    providers: [{ provide: ComparisonService, useValue: service }, ...provideFakeSession()],
  });
  const fixture = TestBed.createComponent(ComparisonPage);
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('ComparisonPage', () => {
  it('shows the four indicators', async () => {
    const { element } = await render(new FakeService());
    const values = Array.from(element.querySelectorAll('.stat-card strong')).map((s) =>
      s.textContent?.trim(),
    );
    expect(values).toEqual(['18.8 %', '2', '1', '0.71']);
  });

  it('draws the 4 × 4 matrix by level name and marks the direction of each change', async () => {
    const { element } = await render(new FakeService());
    const highRow = element.querySelectorAll('.matrix tbody tr')[1];
    const cells = Array.from(highRow.querySelectorAll('td'));
    expect(cells.map((td) => td.textContent?.trim())).toEqual(['2', '3', '0', '0']);
    expect(cells[0].classList).toContain('cell-up');
    expect(cells[1].classList).toContain('cell-same');
    expect(cells[2].classList).toContain('cell-down');
    expect(highRow.querySelector('th')?.textContent?.trim()).toBe('Alta');
  });

  it('lists the funnel stages in order with Spanish names', async () => {
    const { element } = await render(new FakeService());
    const stages = Array.from(element.querySelectorAll('.funnel li')).map((li) => [
      li.querySelector('.funnel-label')?.textContent?.trim(),
      li.querySelector('strong')?.textContent?.trim(),
    ]);
    expect(stages).toEqual([
      ['Hallazgos (crudo)', '40'],
      ['Grupos CVE por producto', '20'],
      ['Con contexto de amenaza', '8'],
      ['Ajustados por el juez', '5'],
      ['Altos o críticos', '6'],
    ]);
  });

  it('shows each finding with a signed delta and its main cause', async () => {
    const { element } = await render(new FakeService());
    const cells = Array.from(element.querySelectorAll('.inventory tbody td')).map((td) =>
      td.textContent?.trim(),
    );
    expect(cells).toEqual([
      'CVE-2026-10002',
      'nginx',
      'SRV-03',
      '9.8',
      '98',
      '40',
      '−2',
      '38',
      '−60',
      'Criticidad y exposición del activo (-45)',
    ]);
    expect(element.querySelector('td.delta')?.classList).toContain('delta-down');
  });

  it('keeps the table when the summary fails, and retries', async () => {
    const service = new FakeService();
    service.summary.mockReturnValueOnce(
      throwError(() => new ApiError(503, 'service_unavailable', 'No disponible.')),
    );
    const { fixture, element } = await render(service);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('No disponible.');
    expect(element.querySelectorAll('.inventory tbody tr').length).toBe(1);
    (element.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(service.summary).toHaveBeenCalledTimes(2);
    expect(element.querySelectorAll('.stat-card').length).toBe(4);
  });

  it('keeps funnel stages it does not know and fills missing matrix cells with zero', async () => {
    const service = new FakeService();
    service.summary.mockReturnValue(
      of({
        ...SUMMARY,
        reclassification_matrix: { critical: { critical: 2 } },
        funnel: { raw: 0, new_stage: 0 },
      }),
    );
    const { element } = await render(service);
    const stages = Array.from(element.querySelectorAll('.funnel li .funnel-label')).map((label) =>
      label.textContent?.trim(),
    );
    expect(stages).toEqual(['Hallazgos (crudo)', 'new_stage']);
    const firstRow = Array.from(
      element.querySelectorAll('.matrix tbody tr')[0].querySelectorAll('td'),
    );
    expect(firstRow.map((td) => td.textContent?.trim())).toEqual(['2', '0', '0', '0']);
  });

  it('says when there are no findings yet', async () => {
    const service = new FakeService();
    service.rows.mockReturnValue(of({ items: [], nextCursor: null }));
    const { element } = await render(service);
    expect(element.querySelector('.inventory')?.textContent).toContain(
      'Aún no hay hallazgos evaluados.',
    );
  });
});
