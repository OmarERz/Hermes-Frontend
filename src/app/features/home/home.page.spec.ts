import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import type { CurrentUser } from '../../core/api/api-types';
import { SessionService } from '../../core/auth/session.service';
import { provideFakeSession } from '../../testing/fake-session';
import { INVENTORY_SUMMARY, TELEMETRY_SUMMARY, TICKET_SUMMARY } from '../agents/agents.fixtures';
import { HomePage } from './home.page';
import { HomeService } from './home.service';

class FakeService {
  inventorySummary = vi.fn<HomeService['inventorySummary']>(() => of(INVENTORY_SUMMARY));
  ticketSummary = vi.fn<HomeService['ticketSummary']>(() => of(TICKET_SUMMARY));
  telemetrySummary = vi.fn<HomeService['telemetrySummary']>(() =>
    of({ ...TELEMETRY_SUMMARY, window: '7d' }),
  );
}

async function render(service: FakeService, profile: Partial<CurrentUser> | null = null) {
  TestBed.configureTestingModule({
    imports: [HomePage],
    providers: [
      { provide: HomeService, useValue: service },
      ...provideFakeSession('reader'),
      provideRouter([]),
    ],
  });
  if (profile) {
    const session = TestBed.inject(SessionService) as unknown as {
      profile: ReturnType<typeof signal<CurrentUser | null>>;
    };
    session.profile.set(profile as CurrentUser);
  }
  const fixture = TestBed.createComponent(HomePage);
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function cards(element: HTMLElement): string[] {
  return Array.from(element.querySelectorAll('.home-metric')).map((card) =>
    [card.querySelector('strong'), card.querySelector('small')]
      .map((part) => (part?.textContent ?? '').trim())
      .join(' '),
  );
}

describe('HomePage', () => {
  it('fills the four summary cards from the inventory, tickets and telemetry summaries', async () => {
    const { element } = await render(new FakeService());
    expect(cards(element)).toEqual([
      '32 Software instalado',
      '28 Activos en iTop',
      '9 Tickets abiertos',
      '88.9 % Éxito de las corridas (7 días)',
    ]);
    expect(element.querySelector('.data-origin')?.textContent).toContain(
      'última sincronización con iTop',
    );
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('greets the person by the name of their profile, else by the user part of the e-mail', async () => {
    let view = await render(new FakeService(), { display_name: 'Ana López' });
    expect(view.element.querySelector('h1')?.textContent).toBe('Hola, Ana López');
    TestBed.resetTestingModule();
    view = await render(new FakeService(), { display_name: null, email: 'omar@hermes.test' });
    expect(view.element.querySelector('h1')?.textContent).toBe('Hola, omar');
    TestBed.resetTestingModule();
    view = await render(new FakeService());
    expect(view.element.querySelector('h1')?.textContent).toBe('Hola, Usuario');
  });

  it('says «Sin datos» when there are no finished runs and when iTop was never synchronised', async () => {
    const service = new FakeService();
    service.telemetrySummary.mockReturnValue(
      of({ ...TELEMETRY_SUMMARY, run_success_percent: null }),
    );
    service.inventorySummary.mockReturnValue(of({ ...INVENTORY_SUMMARY, last_sync_at: null }));
    const { element } = await render(service);
    expect(cards(element)[3]).toBe('Sin datos Éxito de las corridas (7 días)');
    expect(element.querySelector('.data-origin')?.textContent).toContain(
      'iTop todavía no se ha sincronizado',
    );
  });

  it('shows a loading mark while a source has not answered', async () => {
    const service = new FakeService();
    service.ticketSummary.mockReturnValue(NEVER);
    const { element } = await render(service);
    const ticketCard = element.querySelectorAll('.home-metric')[2];
    expect(ticketCard.getAttribute('aria-busy')).toBe('true');
    expect(ticketCard.textContent).toContain('…');
  });

  it('marks the cards of a failed source as unavailable and retries only that source', async () => {
    const service = new FakeService();
    service.inventorySummary.mockReturnValue(
      throwError(() => new ApiError(503, 'service_unavailable', 'Inventario no disponible.')),
    );
    const { fixture, element } = await render(service);
    expect(cards(element).slice(0, 2)).toEqual([
      'No disponible Software instalado',
      'No disponible Activos en iTop',
    ]);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Inventario no disponible.',
    );

    service.inventorySummary.mockReturnValue(of(INVENTORY_SUMMARY));
    (element.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(service.inventorySummary).toHaveBeenCalledTimes(2);
    expect(service.ticketSummary).toHaveBeenCalledTimes(1);
    expect(service.telemetrySummary).toHaveBeenCalledTimes(1);
    expect(cards(element)[0]).toBe('32 Software instalado');
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('retries the tickets and the telemetry when they fail', async () => {
    const service = new FakeService();
    const failure = () => throwError(() => new ApiError(500, 'internal_error', 'Error.'));
    service.ticketSummary.mockReturnValue(failure());
    service.telemetrySummary.mockReturnValue(failure());
    const { fixture } = await render(service);
    fixture.componentInstance.retryFailed();
    expect(service.ticketSummary).toHaveBeenCalledTimes(2);
    expect(service.telemetrySummary).toHaveBeenCalledTimes(2);
    expect(service.inventorySummary).toHaveBeenCalledTimes(1);
  });

  it('links the four main modules', async () => {
    const { element } = await render(new FakeService());
    const links = Array.from(element.querySelectorAll('.home-links a')).map((link) =>
      link.getAttribute('href'),
    );
    expect(links).toEqual(['/agentes', '/software', '/activos', '/configuracion-agente']);
  });
});
