import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { provideFakeSession } from '../../testing/fake-session';
import { LLM_REVIEW } from './agents.fixtures';
import { AgentsService } from './agents.service';
import { dayBoundary } from './formatting';
import { reviewRow, ReviewsLog } from './reviews-log';
import { cardLabelMismatches } from '../../testing/card-labels';

/** Rendering a whole screen in jsdom can pass the 5 s default on a loaded machine. */
const SCREEN = { timeout: 20_000 };

const NEWS_REVIEW = {
  ...LLM_REVIEW,
  id: 'r-2',
  agent: 'news_analyst' as const,
  mode: null,
  status: 'rejected' as const,
  assessment_id: null,
  second_review: true,
};

class FakeService {
  reviews = vi.fn<AgentsService['reviews']>(() =>
    of({ items: [LLM_REVIEW, NEWS_REVIEW], nextCursor: 'n.s' }),
  );
}

async function render(service: FakeService) {
  TestBed.configureTestingModule({
    imports: [ReviewsLog],
    providers: [
      { provide: AgentsService, useValue: service },
      ...provideFakeSession('reader'),
      provideRouter([]),
    ],
  });
  const fixture = TestBed.createComponent(ReviewsLog);
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

const cells = (row: Element) =>
  Array.from(row.querySelectorAll('td')).map((cell) =>
    (cell.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );

async function choose(
  fixture: { whenStable(): Promise<unknown> },
  control: HTMLSelectElement | HTMLInputElement,
  value: string,
) {
  control.value = value;
  control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? 'change' : 'input'));
  await fixture.whenStable();
}

describe('ReviewsLog', SCREEN, () => {
  it('lists each review with its agent, mode, state, tokens, cost and reasons', async () => {
    const { element } = await render(new FakeService());
    const [judge, news] = Array.from(element.querySelectorAll('tbody tr'));
    expect(cells(judge).slice(1, 10)).toEqual([
      'Juez',
      'Puntuación (modo 1)',
      'opus',
      'Aplicada',
      '2',
      '2.4 s',
      '4,100 / 520',
      'USD 0.0071',
      '2 aceptados · 1 rechazados',
    ]);
    // The date cell drops the current year and keeps the full date in its title.
    const date = judge.querySelector('td');
    expect(date?.textContent?.trim()).toBe(reviewRow(LLM_REVIEW).atShort);
    expect(date?.getAttribute('title')).toBe(reviewRow(LLM_REVIEW).at);
    expect(judge.querySelector('a.row-link')?.getAttribute('href')).toBe(
      `/recomendaciones-agente?id=${LLM_REVIEW.assessment_id}`,
    );
    expect(cells(news).slice(1, 5)).toEqual([
      'Analista de noticias Segunda revisión',
      '—',
      'opus',
      'Rechazada por la validación',
    ]);
    expect(cells(news)[9]).toBe('No aplica');
    expect(cells(news)[10]).toBe('—');
    expect(news.querySelector('.status')?.classList).toContain('status-rejected');
  });

  it('labels each field of the phone cards with its column header', async () => {
    const { element } = await render(new FakeService());
    const table = element.querySelector('table.data-table') as HTMLTableElement;
    expect(table.classList).toContain('cards-mobile');
    const { labelled, mismatches } = cardLabelMismatches(table);
    expect(labelled).toBeGreaterThan(0);
    expect(mismatches).toEqual([]);
  });

  it('explains the tokens in the cell title', () => {
    expect(reviewRow(LLM_REVIEW).tokensDetail).toBe(
      'Entrada 4,100 (caché 1,000), salida 520 (razonamiento 80)',
    );
  });

  it('filters by agent, state and dates from the first page, and clears the filters', async () => {
    const service = new FakeService();
    const { fixture, element } = await render(service);
    const [agent, status] = Array.from(element.querySelectorAll('select'));
    const [from, to] = Array.from(
      element.querySelectorAll('input[type="date"]'),
    ) as HTMLInputElement[];
    const clear = element.querySelector('button.clear') as HTMLButtonElement;
    expect(clear.disabled).toBe(true);

    await choose(fixture, agent, 'judge');
    expect(service.reviews).toHaveBeenLastCalledWith(
      { agent: 'judge', status: null, date_from: null, date_to: null },
      null,
      25,
    );
    await choose(fixture, status, 'no_judge_review');
    await choose(fixture, from, '2026-11-01');
    await choose(fixture, to, '2026-11-27');
    expect(service.reviews).toHaveBeenLastCalledWith(
      {
        agent: 'judge',
        status: 'no_judge_review',
        date_from: dayBoundary('2026-11-01', 'from'),
        date_to: dayBoundary('2026-11-27', 'to'),
      },
      null,
      25,
    );
    expect(clear.disabled).toBe(false);

    clear.click();
    await fixture.whenStable();
    expect(service.reviews).toHaveBeenLastCalledWith(
      { agent: null, status: null, date_from: null, date_to: null },
      null,
      25,
    );
  });

  it('pages forward with the cursor as received and back', async () => {
    const service = new FakeService();
    const { fixture, element } = await render(service);
    const [previous, next] = Array.from(
      element.querySelectorAll('.pager button'),
    ) as HTMLButtonElement[];
    expect(previous.disabled).toBe(true);
    next.click();
    await fixture.whenStable();
    expect(service.reviews).toHaveBeenLastCalledWith(expect.anything(), 'n.s', 25);
    expect(element.querySelector('.page-label')?.textContent).toContain('Página 2');
    previous.click();
    await fixture.whenStable();
    expect(service.reviews).toHaveBeenLastCalledWith(expect.anything(), null, 25);
  });

  it('says there are no reviews yet, or none with the filters', async () => {
    const service = new FakeService();
    service.reviews.mockReturnValue(of({ items: [], nextCursor: null }));
    const { fixture, element } = await render(service);
    expect(element.textContent).toContain('Los agentes aún no han hecho revisiones.');
    fixture.componentInstance.setAgent('cve_analyst');
    await fixture.whenStable();
    expect(element.textContent).toContain('No hay revisiones con estos filtros.');
  });

  it('shows the error of the API with a retry', async () => {
    const service = new FakeService();
    service.reviews.mockReturnValue(
      throwError(() => new ApiError(500, 'internal_error', 'Bitácora no disponible.')),
    );
    const { fixture, element } = await render(service);
    const alert = element.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain('Bitácora no disponible.');
    service.reviews.mockReturnValue(of({ items: [LLM_REVIEW], nextCursor: null }));
    (alert.querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(element.querySelectorAll('tbody tr').length).toBe(1);
  });
});
