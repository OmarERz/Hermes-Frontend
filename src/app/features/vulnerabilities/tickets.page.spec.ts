import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { APP_CONFIG } from '../../core/config/app-config';
import { provideFakeSession } from '../../testing/fake-session';
import { TicketsPage } from './tickets.page';
import { ThreatAlert, Ticket, TicketsService } from './tickets.service';

const TICKET: Ticket = {
  itop_id: 'R-000123',
  url: 'https://itop.test/pages/UI.php?operation=details&class=UserRequest&id=123',
  cve: 'CVE-2026-10001',
  custodian: 'Infraestructura Linux',
  urgency: 1,
  status: 'assigned',
  fixed_cis: 1,
  total_cis: 4,
};

const ALERT: ThreatAlert = {
  id: 'al-1',
  created_at: '2026-11-24T00:26:52Z',
  relevance: 'inferred',
  inferred: true,
  actor: 'LockBit',
  victim: null,
  vector: 'phishing',
  summary: 'Campaña contra el sector financiero.',
  ci_id: 'SRV-01',
};

class FakeService {
  listTickets = vi.fn<TicketsService['listTickets']>(() =>
    of({ items: [TICKET], nextCursor: 'n.s' }),
  );
  listAlerts = vi.fn<TicketsService['listAlerts']>(() => of({ items: [ALERT], nextCursor: null }));
}

async function render(service: FakeService) {
  TestBed.configureTestingModule({
    imports: [TicketsPage],
    providers: [
      { provide: TicketsService, useValue: service },
      { provide: APP_CONFIG, useValue: { itopBaseUrl: null } },
      ...provideFakeSession(),
      provideRouter([]),
    ],
  });
  const fixture = TestBed.createComponent(TicketsPage);
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('TicketsPage', () => {
  it('shows each ticket with its urgency, iTop state, progress and iTop link', async () => {
    const { element } = await render(new FakeService());
    const row = element.querySelectorAll('section.inventory')[0].querySelector('tbody tr')!;
    const cells = Array.from(row.querySelectorAll('td')).map((td) =>
      td.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(cells.slice(0, 6)).toEqual([
      'R-000123',
      'CVE-2026-10001',
      'Infraestructura Linux',
      'Crítica',
      'assigned',
      '1 de 4',
    ]);
    expect(row.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('25');
    const link = row.querySelector('app-itop-link a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(TICKET.url);
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('filters by urgency from the first page', async () => {
    const service = new FakeService();
    const { fixture } = await render(service);
    fixture.componentInstance.setUrgency(2);
    expect(service.listTickets).toHaveBeenLastCalledWith(2, null, 25);
    fixture.componentInstance.setUrgency(null);
    expect(service.listTickets).toHaveBeenLastCalledWith(null, null, 25);
  });

  it('shows the alerts with their relevance and links the asset', async () => {
    const { element } = await render(new FakeService());
    const row = element.querySelectorAll('section.inventory')[1].querySelector('tbody tr')!;
    expect(row.textContent).toContain('Inferida por la IA (verificar)');
    expect(row.textContent).toContain('LockBit');
    expect(row.querySelector('.type-chip')?.classList).toContain('inferred');
    expect(row.querySelector('a.row-link')?.getAttribute('href')).toBe('/activos/SRV-01');
  });

  it('shows the error of one list without hiding the other', async () => {
    const service = new FakeService();
    service.listAlerts.mockReturnValue(
      throwError(() => new ApiError(503, 'service_unavailable', 'Alertas no disponibles.')),
    );
    service.listTickets.mockReturnValue(of({ items: [], nextCursor: null }));
    const { element } = await render(service);
    const [tickets, alerts] = Array.from(element.querySelectorAll('section.inventory'));
    expect(tickets.textContent).toContain('Aún no hay tickets creados.');
    expect(alerts.querySelector('[role="alert"]')?.textContent).toContain(
      'Alertas no disponibles.',
    );
  });
});
