import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { provideFakeSession } from '../../testing/fake-session';
import {
  ASSESSMENT_ID,
  FEEDBACK_ENTRY,
  HISTORY_CONFIG,
  HISTORY_REVIEW,
  HISTORY_RUN,
  JUDGE_DETAIL,
  TICKET_UPDATE,
} from './agents.fixtures';
import { AgentsHistoryPage, eventDetail, historyRow, statusOptions } from './agents-history.page';
import { AgentsService } from './agents.service';
import { dayBoundary } from './formatting';

/** Rendering a whole screen in jsdom can pass the 5 s default on a loaded machine. */
const SCREEN = { timeout: 20_000 };

const ANALYST_REVIEW = {
  ...HISTORY_REVIEW,
  id: 'ev-analyst',
  title: 'Análisis de noticia',
  agent: 'news_analyst' as const,
  actor: 'Analista de noticias',
  assessment_id: null,
};

class FakeService {
  history = vi.fn<AgentsService['history']>(() =>
    of({ items: [HISTORY_RUN, HISTORY_REVIEW, HISTORY_CONFIG, ANALYST_REVIEW], nextCursor: 'n.s' }),
  );
  judge = vi.fn<AgentsService['judge']>(() => of(JUDGE_DETAIL));
  feedback = vi.fn<AgentsService['feedback']>(() => of([FEEDBACK_ENTRY]));
  ticketUpdates = vi.fn<AgentsService['ticketUpdates']>(() =>
    of({ items: [TICKET_UPDATE], nextCursor: null }),
  );
}

async function render(service: FakeService) {
  TestBed.configureTestingModule({
    imports: [AgentsHistoryPage],
    providers: [
      { provide: AgentsService, useValue: service },
      ...provideFakeSession('reader'),
      provideRouter([]),
    ],
  });
  const fixture = TestBed.createComponent(AgentsHistoryPage);
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

const text = (node: Element | null | undefined) =>
  (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

const eventRows = (element: HTMLElement) =>
  Array.from(element.querySelectorAll('.history-list-column tbody tr'));

function detailFacts(element: HTMLElement): Record<string, string> {
  const terms = Array.from(element.querySelectorAll('.detail-panel > dl > dt'));
  return Object.fromEntries(terms.map((term) => [text(term), text(term.nextElementSibling)]));
}

async function change(
  fixture: { whenStable(): Promise<unknown> },
  control: HTMLSelectElement | HTMLInputElement,
  value: string,
) {
  control.value = value;
  control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? 'change' : 'input'));
  await fixture.whenStable();
}

describe('AgentsHistoryPage', SCREEN, () => {
  it('lists runs, reviews and configuration changes in one timeline', async () => {
    const { element } = await render(new FakeService());
    const rows = eventRows(element).map((row) =>
      Array.from(row.querySelectorAll('td')).slice(1, 8).map(text),
    );
    expect(rows[0]).toEqual([
      'Corrida',
      'Escaneo simulado',
      '—',
      'Terminó bien',
      'Ana Analista',
      'Lanzada por una persona',
      '2 min 5 s',
    ]);
    expect(rows[1]).toEqual([
      'Revisión de IA',
      'Revisión del juez',
      'Juez',
      'Aplicada',
      'Juez',
      '—',
      '2 s',
    ]);
    expect(rows[2]).toEqual([
      'Cambio de configuración',
      'Sensibilidad del juez: normal → amplia',
      '—',
      'Aplicado',
      'Admin Hermes',
      '—',
      '—',
    ]);
    expect(text(element.querySelector('.detail-empty'))).toContain('Selecciona un evento');
  });

  it('opens the detail of a run with its kind, reason and duration', async () => {
    const { fixture, element } = await render(new FakeService());
    (eventRows(element)[0].querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(eventRows(element)[0].classList).toContain('is-selected');
    const facts = detailFacts(element);
    expect(facts['Tipo de corrida']).toBe('Escaneo simulado');
    expect(facts['Motivo']).toBe('Lanzada por una persona');
    expect(facts['Quién registró']).toBe('Ana Analista');
    expect(facts['Duración']).toBe('2 min 5 s');
    expect(facts['Identificador']).toBe(HISTORY_RUN.id);
    expect(element.querySelector('app-judge-review')).toBeNull();
  });

  it('opens the decision of the judge and the feedback of a judge review', async () => {
    const service = new FakeService();
    const { fixture, element } = await render(service);
    (eventRows(element)[1].querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(service.judge).toHaveBeenCalledWith(ASSESSMENT_ID);
    expect(service.feedback).toHaveBeenCalledWith(ASSESSMENT_ID);
    const review = element.querySelector('app-judge-review')!;
    expect(text(review)).toContain('Explotación masiva');
    expect(text(review)).toContain('Ana Analista: Relevante');
  });

  it('explains why an analyst review has no judge decision, and shows the version of a change', async () => {
    const { fixture, element } = await render(new FakeService());
    (eventRows(element)[3].querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(text(element.querySelector('.detail-note'))).toContain('Los analistas no deciden');

    (eventRows(element)[2].querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(detailFacts(element)['Versión de configuración']).toBe('Versión 7');
    expect(detailFacts(element)['Duración']).toBeUndefined();

    (element.querySelector('.detail-panel header button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(element.querySelector('.detail-empty')).not.toBeNull();
  });

  it('gives the list the whole width until an event is chosen, then scrolls its detail into view', async () => {
    const scroll = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scroll;
    try {
      const { fixture, element } = await render(new FakeService());
      const layout = element.querySelector('.history-layout') as HTMLElement;
      const panel = element.querySelector('aside.detail-panel') as HTMLElement;
      expect(layout.classList).not.toContain('has-detail');
      expect(panel.classList).toContain('is-empty');

      const opener = eventRows(element)[0].querySelector('button') as HTMLButtonElement;
      opener.click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(layout.classList).toContain('has-detail');
      expect(panel.classList).not.toContain('is-empty');
      expect(scroll).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
      // Focus goes to the detail, and back to its «Detalle» button when it closes.
      expect(document.activeElement).toBe(panel.querySelector('h2'));

      (element.querySelector('.detail-panel header button') as HTMLButtonElement).click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(layout.classList).not.toContain('has-detail');
      expect(panel.classList).toContain('is-empty');
      expect(document.activeElement).toBe(opener);
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
    }
  });

  it('scrolls without animation when the person asked for reduced motion', async () => {
    const scroll = vi.fn();
    const originalScroll = HTMLElement.prototype.scrollIntoView;
    const originalMatch = window.matchMedia;
    HTMLElement.prototype.scrollIntoView = scroll;
    window.matchMedia = vi.fn(
      (query: string) => ({ matches: query.includes('reduce') }) as MediaQueryList,
    );
    try {
      const { fixture, element } = await render(new FakeService());
      (eventRows(element)[0].querySelector('button') as HTMLButtonElement).click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(scroll).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' });
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScroll;
      window.matchMedia = originalMatch;
    }
  });

  it('names the detail panel, so it is told apart from the sidebar landmark', async () => {
    const { element } = await render(new FakeService());
    expect(element.querySelector('aside.detail-panel')?.getAttribute('aria-label')).toBe(
      'Detalle del evento',
    );
  });

  it('says when a judge review fed no evaluation', async () => {
    const service = new FakeService();
    service.history.mockReturnValue(
      of({ items: [{ ...HISTORY_REVIEW, assessment_id: null }], nextCursor: null }),
    );
    const { fixture, element } = await render(service);
    (eventRows(element)[0].querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(text(element.querySelector('.detail-note'))).toBe(
      'Esta revisión no alimentó ninguna evaluación.',
    );
  });

  it('filters by dates, type and final state from the first page, and clears the filters', async () => {
    const service = new FakeService();
    const { fixture, element } = await render(service);
    const [from, to] = Array.from(element.querySelectorAll('.filters input')) as HTMLInputElement[];
    const [type, status] = Array.from(
      element.querySelectorAll('.filters select'),
    ) as HTMLSelectElement[];

    await change(fixture, type, 'run');
    expect(Array.from(status.options).map((option) => option.textContent?.trim())).toEqual([
      'Todos',
      'En cola',
      'En ejecución',
      'Terminó bien',
      'Terminó con error',
    ]);
    await change(fixture, status, 'failed');
    await change(fixture, from, '2026-11-01');
    await change(fixture, to, '2026-11-27');
    expect(service.history).toHaveBeenLastCalledWith(
      {
        type: 'run',
        status: 'failed',
        date_from: dayBoundary('2026-11-01', 'from'),
        date_to: dayBoundary('2026-11-27', 'to'),
      },
      null,
      25,
    );

    // A type without that state drops it.
    await change(fixture, type, 'config_change');
    expect(service.history).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'config_change', status: null }),
      null,
      25,
    );

    (element.querySelector('.history-panel .clear') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(service.history).toHaveBeenLastCalledWith(
      { type: null, status: null, date_from: null, date_to: null },
      null,
      25,
    );
  });

  it('keeps the state when the new type also has it, and closes the detail on a new filter', async () => {
    const service = new FakeService();
    const { fixture } = await render(service);
    const page = fixture.componentInstance;
    page.select(HISTORY_RUN);
    page.setStatus('queued');
    expect(page.selected()).toBeNull();
    page.setType('llm_review');
    expect(page.status()).toBe('queued');
  });

  it('pages forward and back with the cursor as received', async () => {
    const service = new FakeService();
    const { fixture, element } = await render(service);
    const [previous, next] = Array.from(
      element.querySelectorAll('.history-list-column .pager button'),
    ) as HTMLButtonElement[];
    next.click();
    await fixture.whenStable();
    expect(service.history).toHaveBeenLastCalledWith(expect.anything(), 'n.s', 25);
    previous.click();
    await fixture.whenStable();
    expect(service.history).toHaveBeenLastCalledWith(expect.anything(), null, 25);
  });

  it('shows the empty and error states of the timeline', async () => {
    const service = new FakeService();
    service.history.mockReturnValue(of({ items: [], nextCursor: null }));
    let view = await render(service);
    expect(text(view.element.querySelector('.table-panel'))).toContain(
      'Aún no hay eventos en el historial.',
    );
    view.fixture.componentInstance.setType('run');
    await view.fixture.whenStable();
    expect(text(view.element.querySelector('.table-panel'))).toContain(
      'No hay eventos con estos filtros.',
    );
    TestBed.resetTestingModule();

    service.history.mockReturnValue(
      throwError(() => new ApiError(500, 'internal_error', 'Historial no disponible.')),
    );
    view = await render(service);
    expect(view.element.querySelector('.table-panel [role="alert"]')?.textContent).toContain(
      'Historial no disponible.',
    );
  });

  it('shows the ticket log under the timeline', async () => {
    const { element } = await render(new FakeService());
    expect(text(element.querySelector('app-ticket-log'))).toContain('R-000123');
  });
});

describe('history helpers', () => {
  it('offers every state once when no type is chosen', () => {
    const options = statusOptions('');
    expect(options.map((option) => option.value)).toContain('applied');
    expect(new Set(options.map((option) => option.value)).size).toBe(options.length);
    expect(options.find((option) => option.value === 'applied')?.label).toBe('Aplicado');
    expect(options.find((option) => option.value === 'queued')?.label).toBe('En cola');
  });

  it('shows an unfinished run without a duration', () => {
    expect(historyRow({ ...HISTORY_RUN, duration_seconds: null }).duration).toBe('Sin terminar');
    expect(eventDetail({ ...HISTORY_RUN, trigger: null, run_kind: null })).toEqual(
      expect.arrayContaining([
        { term: 'Tipo de corrida', value: '—' },
        { term: 'Motivo', value: '—' },
      ]),
    );
  });
});
