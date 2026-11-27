import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { provideFakeSession } from '../../testing/fake-session';
import { TICKET_UPDATE } from './agents.fixtures';
import { AgentsService } from './agents.service';
import { TicketLog, ticketIdOf, ticketRow } from './ticket-log';

const PENDING = {
  ...TICKET_UPDATE,
  id: 'u-2',
  action: 'raise_urgency' as const,
  label: '',
  ticket_itop_id: null,
  ticket_ref: null,
  ticket_url: null,
  assessment_id: null,
  itop_status: null,
};

class FakeService {
  ticketUpdates = vi.fn<AgentsService['ticketUpdates']>(() =>
    of({ items: [TICKET_UPDATE, PENDING], nextCursor: 'n.s' }),
  );
}

async function render(service: FakeService) {
  TestBed.configureTestingModule({
    imports: [TicketLog],
    providers: [
      { provide: AgentsService, useValue: service },
      ...provideFakeSession('reader'),
      provideRouter([]),
    ],
  });
  const fixture = TestBed.createComponent(TicketLog);
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

const cells = (row: Element) =>
  Array.from(row.querySelectorAll('td')).map((cell) =>
    (cell.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );

describe('TicketLog', () => {
  it('lists what Hermes did on each ticket, with the iTop link and the evaluation', async () => {
    const { element } = await render(new FakeService());
    const [created, pending] = Array.from(element.querySelectorAll('tbody tr'));
    expect(cells(created).slice(1, 6)).toEqual([
      'R-000123 (abre iTop en otra pestaña)',
      'CVE-2026-10001',
      'Infraestructura Linux',
      'Ticket creado',
      'Escrito en iTop',
    ]);
    const itop = created.querySelector('td:nth-child(2) a') as HTMLAnchorElement;
    expect(itop.getAttribute('href')).toBe(TICKET_UPDATE.ticket_url);
    expect(itop.getAttribute('rel')).toBe('noopener noreferrer');
    expect(created.querySelector('td:last-child a')?.getAttribute('href')).toBe(
      `/recomendaciones-agente?id=${TICKET_UPDATE.assessment_id}`,
    );
    expect(cells(pending).slice(1, 7)).toEqual([
      'Por crear en iTop',
      'CVE-2026-10001',
      'Infraestructura Linux',
      'Urgencia subida',
      'Sin dato (purgado)',
      '—',
    ]);
  });

  it('never links a ticket URL that is not http(s)', () => {
    expect(ticketRow({ ...TICKET_UPDATE, ticket_url: 'javascript:alert(1)' }).url).toBeNull();
  });

  it('reads a ticket number or reference', () => {
    expect(ticketIdOf('123')).toBe('123');
    expect(ticketIdOf(' R-000123 ')).toBe('123');
    expect(ticketIdOf('r000045')).toBe('45');
    expect(ticketIdOf('')).toBe('');
    expect(ticketIdOf('abc')).toBeNull();
    expect(ticketIdOf('1234567890123')).toBeNull();
  });

  it('filters by ticket and action from the first page, and clears the filters', async () => {
    const service = new FakeService();
    const { fixture, element } = await render(service);
    const input = element.querySelector('input') as HTMLInputElement;
    input.value = 'R-000123';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(service.ticketUpdates).toHaveBeenLastCalledWith(
      { ticket_itop_id: '123', action: null },
      null,
      25,
    );
    // The same ticket again (Enter after the change) does not reload.
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(service.ticketUpdates).toHaveBeenCalledTimes(2);

    const select = element.querySelector('select') as HTMLSelectElement;
    select.value = 'add_ci';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(service.ticketUpdates).toHaveBeenLastCalledWith(
      { ticket_itop_id: '123', action: 'add_ci' },
      null,
      25,
    );

    (element.querySelector('button.clear') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(service.ticketUpdates).toHaveBeenLastCalledWith(
      { ticket_itop_id: null, action: null },
      null,
      25,
    );
    expect(input.value).toBe('');
  });

  it('does not send a ticket that is not a number or a reference', async () => {
    const service = new FakeService();
    const { fixture, element } = await render(service);
    const input = element.querySelector('input') as HTMLInputElement;
    input.value = 'servidor-01';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(service.ticketUpdates).toHaveBeenCalledTimes(1);
    expect(element.querySelector('#ticket-error')?.textContent).toContain('número del ticket');
    expect(input.getAttribute('aria-invalid')).toBe('true');

    input.value = '7';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(element.querySelector('#ticket-error')).toBeNull();
    expect(service.ticketUpdates).toHaveBeenCalledTimes(2);
  });

  it('pages with the cursor as received', async () => {
    const service = new FakeService();
    const { fixture, element } = await render(service);
    const [previous, next] = Array.from(
      element.querySelectorAll('.pager button'),
    ) as HTMLButtonElement[];
    next.click();
    await fixture.whenStable();
    expect(service.ticketUpdates).toHaveBeenLastCalledWith(expect.anything(), 'n.s', 25);
    previous.click();
    await fixture.whenStable();
    expect(service.ticketUpdates).toHaveBeenLastCalledWith(expect.anything(), null, 25);
  });

  it('shows the empty and error states', async () => {
    const service = new FakeService();
    service.ticketUpdates.mockReturnValue(of({ items: [], nextCursor: null }));
    let view = await render(service);
    expect(view.element.textContent).toContain('Hermes aún no ha escrito en tickets.');
    view.fixture.componentInstance.setAction('reopen');
    await view.fixture.whenStable();
    expect(view.element.textContent).toContain('No hay registros con estos filtros.');
    TestBed.resetTestingModule();

    service.ticketUpdates.mockReturnValue(
      throwError(() => new ApiError(500, 'internal_error', 'Bitácora no disponible.')),
    );
    view = await render(service);
    expect(view.element.querySelector('[role="alert"]')?.textContent).toContain(
      'Bitácora no disponible.',
    );
  });
});
