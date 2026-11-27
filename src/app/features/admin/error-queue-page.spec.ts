import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { provideFakeSession } from '../../testing/fake-session';
import { formatDateTime, formatShortDateTime } from '../../shared/labels';
import { ErrorQueuePage } from './error-queue.page';
import { ErrorQueueItem, ErrorQueueService, NotificationEventRow } from './error-queue.service';
import { cardLabelMismatches } from '../../testing/card-labels';

const NOTIFICATION: ErrorQueueItem = {
  id: '0196a6f0-0000-7000-8000-0000000000aa',
  kind: 'notification',
  created_at: '2026-11-27T08:00:00Z',
  status: 'failed',
  attempts: 5,
  next_attempt_at: null,
  error: 'Slack respondió 503 <b>no</b>',
  component: 'new_ticket',
  cve: 'CVE-2026-10001',
  ticket_itop_id: '123',
  ticket_ref: 'R-000123',
  assessment_id: '0196a6f0-0000-7000-8000-0000000000bb',
  retryable: true,
};

const ITOP: ErrorQueueItem = {
  id: '0196a6f0-0000-7000-8000-0000000000cc',
  kind: 'itop',
  created_at: '2026-11-27T07:00:00Z',
  status: 'failed',
  attempts: 8,
  next_attempt_at: null,
  error: 'iTop no respondió',
  component: 'add_ci',
  cve: 'CVE-2026-10002',
  ticket_itop_id: '124',
  ticket_ref: null,
  assessment_id: null,
  retryable: false,
};

const LLM: ErrorQueueItem = {
  id: '0196a6f0-0000-7000-8000-0000000000dd',
  kind: 'llm_validation',
  created_at: '2026-11-26T07:00:00Z',
  status: 'pending',
  attempts: 3,
  // The backend lists a pending item only when no run retries it any more.
  next_attempt_at: null,
  error: null,
  component: 'news_analyst',
  cve: null,
  ticket_itop_id: null,
  ticket_ref: null,
  assessment_id: null,
  retryable: false,
};

class FakeQueue {
  list = vi.fn<ErrorQueueService['list']>(() =>
    of({ items: [NOTIFICATION, ITOP, LLM], nextCursor: 'n.s' }),
  );
  retry = vi.fn<ErrorQueueService['retry']>(() =>
    of({ id: NOTIFICATION.id, status: 'pending' } as NotificationEventRow),
  );
}

async function render(queue = new FakeQueue()) {
  TestBed.configureTestingModule({
    imports: [ErrorQueuePage],
    providers: [
      { provide: ErrorQueueService, useValue: queue },
      ...provideFakeSession('admin'),
      provideRouter([]),
    ],
  });
  const fixture = TestBed.createComponent(ErrorQueuePage);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return { page: fixture.componentInstance, element, queue, settle };
}

/** The visible text, one space between the texts of separate elements (the template has no whitespace there). */
function text(element: Element | null | undefined): string {
  if (!element) return '';
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  while (walker.nextNode()) parts.push(walker.currentNode.textContent ?? '');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function rows(element: HTMLElement): HTMLTableRowElement[] {
  return Array.from(element.querySelectorAll('.errors-table tbody tr'));
}

function cells(row: Element): string[] {
  return Array.from(row.querySelectorAll('td')).map((cell) => text(cell));
}

describe('ErrorQueuePage', () => {
  it('shows each failed item with its origin, state, attempts, error and related data', async () => {
    const { element } = await render();
    const [notification, itop, llm] = rows(element);
    expect(cells(notification)).toEqual([
      formatShortDateTime(NOTIFICATION.created_at),
      'Notificación Ticket nuevo',
      'Agotó sus reintentos',
      '5',
      'Sin reintento',
      'Slack respondió 503 <b>no</b>',
      'CVE-2026-10001 Ticket R-000123 Ver recomendación',
      'Reintentar',
    ]);
    // The cells keep the full date and the whole error in their title.
    expect(notification.querySelector('td')?.getAttribute('title')).toBe(
      formatDateTime(NOTIFICATION.created_at),
    );
    expect(notification.querySelector('td.error-text span')?.getAttribute('title')).toBe(
      'Slack respondió 503 <b>no</b>',
    );
    // External text is data: never HTML.
    expect(notification.querySelector('td.error-text b')).toBeNull();
    expect(notification.querySelector('a.row-link')?.getAttribute('href')).toBe(
      `/recomendaciones-agente?id=${NOTIFICATION.assessment_id}`,
    );
    expect(cells(itop)[6]).toBe('CVE-2026-10002 Ticket 124');
    expect(itop.querySelector('button')).toBeNull();
    expect(cells(llm).slice(1, 7)).toEqual([
      'Validación del LLM Analista de noticias',
      'Pendiente, sin reintento programado',
      '3',
      'Sin reintento',
      'Sin detalle',
      '—',
    ]);
    expect(llm.querySelector('app-chip')?.getAttribute('data-tone')).toBe('danger');
    // The raw value of the API stays in the tooltip.
    expect(llm.querySelector('small[title]')?.getAttribute('title')).toBe('news_analyst');
  });

  it('labels each field of the phone cards with its column header', async () => {
    const { element } = await render();
    const table = element.querySelector('table.errors-table') as HTMLTableElement;
    expect(table.classList).toContain('cards-mobile');
    const { labelled, mismatches } = cardLabelMismatches(table);
    expect(labelled).toBeGreaterThan(0);
    expect(mismatches).toEqual([]);
  });

  it('says a retry is scheduled only when the API gives its date', async () => {
    const queue = new FakeQueue();
    const scheduled = { ...LLM, next_attempt_at: '2026-11-27T10:00:00Z' };
    const unknown = {
      ...ITOP,
      id: 'x',
      status: 'stuck' as ErrorQueueItem['status'],
      kind: 'other' as ErrorQueueItem['kind'],
    };
    queue.list.mockReturnValue(of({ items: [scheduled, unknown], nextCursor: null }));
    const { element } = await render(queue);
    const [row, other] = rows(element);
    expect(cells(row).slice(2, 5)).toEqual([
      'Espera su próximo reintento',
      '3',
      formatShortDateTime(scheduled.next_attempt_at),
    ]);
    expect(row.querySelector('app-chip')?.getAttribute('data-tone')).toBe('warning');
    // Values the front does not know yet are shown as they come.
    expect(cells(other).slice(1, 3)).toEqual(['other add_ci', 'stuck']);
  });

  it('filters by origin from the first page', async () => {
    const { element, queue } = await render();
    const select = element.querySelector('.filter-bar select') as HTMLSelectElement;
    select.value = 'llm_validation';
    select.dispatchEvent(new Event('change'));
    expect(queue.list).toHaveBeenLastCalledWith('llm_validation', null, 50);
    select.value = '';
    select.dispatchEvent(new Event('change'));
    expect(queue.list).toHaveBeenLastCalledWith(null, null, 50);
  });

  it('retries a notification, says so and reads the list again', async () => {
    const { element, queue, settle } = await render();
    const listed = queue.list.mock.calls.length;
    (rows(element)[0].querySelector('button') as HTMLButtonElement).click();
    await settle();
    expect(queue.retry).toHaveBeenCalledWith(NOTIFICATION.id);
    expect(text(element.querySelector('.admin-notice[role="status"]'))).toBe(
      'La notificación «Ticket nuevo» volvió a la cola: Hermes intentará entregarla de nuevo.',
    );
    expect(queue.list.mock.calls.length).toBe(listed + 1);
  });

  it('disables the retry while it is on its way and ignores a second click', async () => {
    const queue = new FakeQueue();
    const pending = new Subject<NotificationEventRow>();
    queue.retry.mockReturnValue(pending.asObservable());
    const { element, page, settle } = await render(queue);
    const button = rows(element)[0].querySelector('button') as HTMLButtonElement;
    button.click();
    await settle();
    expect(button.disabled).toBe(true);
    expect(text(button)).toBe('Reintentando…');
    page.retry(page.rows()[0]);
    page.retry(page.rows()[1]);
    expect(queue.retry).toHaveBeenCalledTimes(1);
    pending.complete();
    await settle();
    expect(page.isRetrying(NOTIFICATION.id)).toBe(false);
  });

  it('reads the list again when the event is no longer in error', async () => {
    const queue = new FakeQueue();
    queue.retry.mockReturnValue(
      throwError(() => new ApiError(409, 'not_in_error', 'El evento ya no está en error.')),
    );
    const { element, queue: fake, settle } = await render(queue);
    const listed = fake.list.mock.calls.length;
    (rows(element)[0].querySelector('button') as HTMLButtonElement).click();
    await settle();
    expect(text(element.querySelector('.admin-notice[role="alert"]'))).toBe(
      'El evento ya no está en error.',
    );
    expect(fake.list.mock.calls.length).toBe(listed + 1);
  });

  it('keeps the list after another refusal of the retry', async () => {
    const queue = new FakeQueue();
    queue.retry.mockReturnValue(
      throwError(() => new ApiError(500, 'internal_error', 'Ocurrió un error en el servidor.')),
    );
    const { element, settle } = await render(queue);
    const listed = queue.list.mock.calls.length;
    (rows(element)[0].querySelector('button') as HTMLButtonElement).click();
    await settle();
    expect(text(element.querySelector('.admin-notice[role="alert"]'))).toBe(
      'Ocurrió un error en el servidor.',
    );
    expect(queue.list.mock.calls.length).toBe(listed);
  });

  it('says when the queue is empty, for every origin or for one', async () => {
    const queue = new FakeQueue();
    queue.list.mockReturnValue(of({ items: [], nextCursor: null }));
    const { element, page, settle } = await render(queue);
    expect(text(element.querySelector('app-async-state'))).toBe(
      'No hay errores pendientes. Todo se entregó.',
    );
    page.setKind('itop');
    await settle();
    expect(text(element.querySelector('app-async-state'))).toBe('No hay errores de este origen.');
  });

  it('shows the error of the list with a retry, refreshes and pages by cursor', async () => {
    const queue = new FakeQueue();
    queue.list.mockReturnValueOnce(
      throwError(
        () => new ApiError(403, 'forbidden', 'No tienes permiso para realizar esta acción.'),
      ),
    );
    const { element, page, settle } = await render(queue);
    expect(text(element.querySelector('[role="alert"]'))).toContain('No tienes permiso');
    (element.querySelector('app-async-state button') as HTMLButtonElement).click();
    await settle();
    expect(rows(element)).toHaveLength(3);
    (
      element.querySelector(
        '[aria-label="Página siguiente de la cola de errores"]',
      ) as HTMLButtonElement
    ).click();
    await settle();
    expect(queue.list).toHaveBeenLastCalledWith(null, 'n.s', 50);
    page.notice.set({ kind: 'ok', text: 'Hecho.' });
    (element.querySelector('.filter-actions button') as HTMLButtonElement).click();
    expect(page.notice()).toBeNull();
    expect(queue.list).toHaveBeenLastCalledWith(null, 'n.s', 50);
  });
});
