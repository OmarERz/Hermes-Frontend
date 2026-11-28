import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import type { Role } from '../../core/api/api-types';
import { APP_CONFIG, type AppConfig } from '../../core/config/app-config';
import { provideFakeSession } from '../../testing/fake-session';
import { recommendation, RECOMMENDATION } from './recommendation.fixtures';
import { RecommendationsPage } from './recommendations.page';
import { RecommendationsService } from './recommendations.service';

const CONFIG: AppConfig = {
  production: false,
  apiBaseUrl: '',
  firebase: null,
  authEmulatorUrl: null,
  itopBaseUrl: null,
};

const NEWEST = RECOMMENDATION;
const OLDER = recommendation({
  assessment_id: '0192f3a4-0000-7c2d-8a5f-000000000001',
  created_at: '2026-11-20T09:00:00Z',
  base: 70,
  judge_adjustment: 0,
  final: 70,
  level: 'medium',
  previous_final: null,
  mitigation: null,
  mitigation_draft: null,
  feedback_count: 2,
});
const OTHER = recommendation({
  assessment_id: '0192f3a4-0000-7c2d-8a5f-000000000002',
  cve: 'CVE-2026-20002',
  product: 'nginx 1.25',
  level: 'critical',
  final: 93,
  feedback_count: 1,
});

class FakeService {
  list = vi.fn<RecommendationsService['list']>(() =>
    of({ items: [NEWEST, OTHER, OLDER], nextCursor: null }),
  );
  get = vi.fn<RecommendationsService['get']>(() => of(OTHER));
  feedback = vi.fn<RecommendationsService['feedback']>(() => of([]));
  send = vi.fn<RecommendationsService['send']>();
  levelBands = vi.fn<RecommendationsService['levelBands']>(() => of(null));
}

async function render(
  service: FakeService,
  url = '/recomendaciones-agente',
  role: Role = 'reader',
) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'recomendaciones-agente', component: RecommendationsPage }]),
      { provide: RecommendationsService, useValue: service },
      { provide: APP_CONFIG, useValue: CONFIG },
      ...provideFakeSession(role),
    ],
  });
  const harness = await RouterTestingHarness.create();
  const page = await harness.navigateByUrl(url, RecommendationsPage);
  harness.detectChanges();
  await harness.fixture.whenStable();
  return { harness, page, element: harness.routeNativeElement as HTMLElement };
}

const texts = (root: HTMLElement, selector: string) =>
  Array.from(root.querySelectorAll(selector)).map((node) => node.textContent?.trim() ?? '');

describe('RecommendationsPage', () => {
  it('groups the page by vulnerability and shows the newest case first', async () => {
    const service = new FakeService();
    const { element } = await render(service);
    expect(service.list).toHaveBeenCalledWith({}, null, 50);
    expect(texts(element, '.ticket-option strong')).toEqual(['CVE-2026-10001', 'CVE-2026-20002']);
    expect(texts(element, '.ticket-option .conflict-chip')).toEqual(['Sin feedback']);
    expect(element.querySelector('.detail-heading h2')?.textContent).toContain(
      'CVE-2026-10001 · OpenSSL 3.0.7',
    );
    expect(element.querySelectorAll('app-recommendation-card')).toHaveLength(2);
  });

  it('shows base, judge and final, the justification and the mitigation with the IA label', async () => {
    const { element } = await render(new FakeService());
    const card = element.querySelector('app-recommendation-card') as HTMLElement;
    expect(texts(card, '.recommendation-score-grid strong')).toEqual(['74', '+12', '86']);
    expect(card.textContent).toContain('Base 74 → Juez +12 → Final 86');
    expect(card.textContent).toContain('↑ Sube 16');
    expect(card.textContent).toContain(RECOMMENDATION.justification);
    expect(card.textContent).toContain('Actualizar OpenSSL a la versión 3.0.8 o superior.');
    expect(card.querySelector('.ai-badge')?.textContent?.trim()).toBe('IA');
    expect(texts(card, '.mitigation-steps li')).toEqual(RECOMMENDATION.mitigation_draft ?? []);
    expect(card.querySelector('.ticket-line')?.textContent).toContain('1234');
    expect(card.querySelector('.ticket-line a')?.getAttribute('href')).toBe(
      RECOMMENDATION.ticket_url,
    );
    expect(card.querySelector('.asset-panel')?.textContent).toContain('Infraestructura Linux');
    expect(card.querySelector('.judge-pending')?.textContent).toContain('Pendiente de la API');
  });

  it('renders the justification headings as strong text, never as HTML', async () => {
    const service = new FakeService();
    service.list.mockReturnValue(
      of({
        items: [
          recommendation({
            justification:
              '**Base 74 → Final 86 · impulsada por srv\\_pagos.** CVSS 7.5 <img src=x onerror=alert(1)>.',
          }),
        ],
        nextCursor: null,
      }),
    );
    const { element } = await render(service);
    const justification = element.querySelector('.justification') as HTMLElement;
    expect(texts(justification, 'strong')).toEqual([
      'Base 74 → Final 86 · impulsada por srv_pagos.',
    ]);
    expect(justification.textContent).not.toContain('**');
    expect(justification.textContent).toContain('CVSS 7.5 <img src=x onerror=alert(1)>.');
    expect(justification.querySelector('img')).toBeNull();
    expect(texts(element, '.ticket-option small')[1]).toContain('1 evaluación');
  });

  it('never fills in what the evaluation does not have', async () => {
    const { element } = await render(new FakeService());
    const older = element.querySelectorAll('app-recommendation-card')[1] as HTMLElement;
    expect(older.textContent).toContain('Sin evaluación anterior');
    expect(older.textContent).toContain('Sin mitigación en las fuentes.');
    expect(older.querySelector('.ai-badge')).toBeNull();
    expect(texts(older, '.recommendation-score-grid strong')).toEqual(['70', '0', '70']);
  });

  it('shows the feedback count and opens the feedback history on demand', async () => {
    const service = new FakeService();
    const { harness, element } = await render(service);
    const cards = element.querySelectorAll('app-recommendation-card');
    expect(cards[0].querySelector('.feedback-summary p')?.textContent).toBe(
      'Sin feedback todavía.',
    );
    expect(cards[1].querySelector('.feedback-summary p')?.textContent).toBe(
      '2 feedbacks vigentes.',
    );
    expect(service.feedback).not.toHaveBeenCalled();
    (cards[1].querySelector('.feedback-summary button') as HTMLButtonElement).click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(service.feedback).toHaveBeenCalledWith(OLDER.assessment_id);
    expect(cards[1].querySelector('app-feedback-history')).not.toBeNull();
  });

  it('opens another case of the list', async () => {
    const { harness, element } = await render(new FakeService());
    (element.querySelectorAll('.ticket-option')[1] as HTMLButtonElement).click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(element.querySelector('.detail-heading h2')?.textContent).toContain('CVE-2026-20002');
    expect(element.querySelectorAll('app-recommendation-card')).toHaveLength(1);
  });

  it('filters the loaded page by level and by «sin feedback»', async () => {
    const { harness, page, element } = await render(new FakeService());
    page.level.set('critical');
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(texts(element, '.ticket-option strong')).toEqual(['CVE-2026-20002']);

    page.level.set('');
    page.withoutFeedback.set(true);
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(texts(element, '.ticket-option strong')).toEqual(['CVE-2026-10001']);
    expect(element.querySelectorAll('app-recommendation-card')).toHaveLength(1);

    page.level.set('low');
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(element.querySelector('.list-state')?.textContent).toContain(
      'Ninguna evaluación de esta página cumple los filtros.',
    );
  });

  it('opens the evaluation of a direct link, also from the prototype link', async () => {
    const service = new FakeService();
    const { harness, element } = await render(
      service,
      `/recomendaciones-agente?recomendacionId=${OTHER.assessment_id}`,
    );
    expect(service.get).toHaveBeenCalledWith(OTHER.assessment_id);
    expect(element.querySelector('.detail-heading small')?.textContent).toContain(
      'Recomendación solicitada',
    );
    expect(element.querySelector('.ticket-option.active strong')?.textContent).toBe(
      'CVE-2026-20002',
    );

    (element.querySelector('.ticket-option') as HTMLButtonElement).click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(element.querySelector('.detail-heading small')?.textContent).toContain(
      'Vulnerabilidad seleccionada',
    );
  });

  it('shows why a direct link failed and lets the person retry', async () => {
    const service = new FakeService();
    service.get.mockReturnValueOnce(
      throwError(() => new ApiError(404, 'not_found', 'La evaluación no existe.')),
    );
    const { harness, element } = await render(
      service,
      `/recomendaciones-agente?id=${NEWEST.assessment_id}`,
    );
    expect(element.querySelector('.recommendation-detail')?.textContent).toContain(
      'La evaluación no existe.',
    );
    (element.querySelector('.recommendation-detail button') as HTMLButtonElement).click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(service.get).toHaveBeenCalledTimes(2);
  });

  it('narrows the list to the timeline of a vulnerability group', async () => {
    const service = new FakeService();
    const { element } = await render(service, '/recomendaciones-agente?group_id=g-1');
    expect(service.list).toHaveBeenCalledWith({ group_id: 'g-1' }, null, 50);
    expect(element.querySelector('.scope-note')?.textContent).toContain(
      'Línea de tiempo de una vulnerabilidad',
    );
  });

  it('shows the error of the list with a retry', async () => {
    const service = new FakeService();
    service.list.mockReturnValueOnce(
      throwError(() => new ApiError(503, 'auth_unavailable', 'El servicio no responde.')),
    );
    const { harness, element } = await render(service);
    expect(element.querySelector('.list-state')?.textContent).toContain('El servicio no responde.');
    (element.querySelector('.list-state button') as HTMLButtonElement).click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(service.list).toHaveBeenCalledTimes(2);
    expect(texts(element, '.ticket-option strong')).toHaveLength(2);
  });

  it('offers feedback only to analyst and admin', async () => {
    const reader = await render(new FakeService(), '/recomendaciones-agente', 'reader');
    expect(reader.element.querySelector('.give-feedback')).toBeNull();
    TestBed.resetTestingModule();

    for (const role of ['analyst', 'admin'] as const) {
      const { element } = await render(new FakeService(), '/recomendaciones-agente', role);
      expect(element.querySelectorAll('.give-feedback')).toHaveLength(2);
      TestBed.resetTestingModule();
    }
  });

  it('never opens the feedback dialog for a reader', async () => {
    const { harness, page, element } = await render(new FakeService());
    page.openFeedback(NEWEST);
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(element.querySelector('app-feedback-dialog')).toBeNull();
  });

  it('opens the dialog for an evaluation and refreshes the list after a save', async () => {
    const service = new FakeService();
    service.levelBands.mockReturnValue(of(null));
    service.send.mockReturnValue(
      of({ feedback_id: '0192f3a5-1c2d-7e3f-9a4b-5c6d7e8f9a0b', replaced_previous: true }),
    );
    const { harness, page, element } = await render(service, '/recomendaciones-agente', 'analyst');
    (element.querySelectorAll('.give-feedback')[1] as HTMLButtonElement).click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    const dialog = element.querySelector('app-feedback-dialog') as HTMLElement;
    // N-15 (F19.8): the level chip of the dialog has the tone of its level, as on the page.
    expect(dialog.querySelector('app-chip.dialog-level')?.textContent).toBe('Media');
    expect(dialog.querySelector('app-chip.dialog-level')?.getAttribute('data-tone')).toBe('medium');

    (dialog.querySelector('.decision-option input') as HTMLInputElement).click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    (dialog.querySelector('.review-save') as HTMLButtonElement).click();
    harness.detectChanges();
    await harness.fixture.whenStable();

    expect(service.send).toHaveBeenCalledWith(
      expect.objectContaining({ assessment_id: OLDER.assessment_id, verdict: 'relevant' }),
    );
    expect(element.querySelector('app-feedback-dialog')).toBeNull();
    expect(element.querySelector('.review-saved-message')?.textContent).toContain(
      'Reemplaza tu feedback anterior',
    );
    expect(service.list).toHaveBeenCalledTimes(2);
    expect(page.feedbackSaves()).toBe(1);
  });

  it('reloads a linked evaluation after its feedback is saved', async () => {
    const service = new FakeService();
    const { page } = await render(
      service,
      `/recomendaciones-agente?id=${OTHER.assessment_id}`,
      'analyst',
    );
    page.onFeedbackSaved({
      feedback_id: '0192f3a5-1c2d-7e3f-9a4b-5c6d7e8f9a0b',
      replaced_previous: false,
    });
    expect(service.get).toHaveBeenCalledTimes(2);
    expect(page.savedMessage()).toBe('Feedback guardado.');
  });
});
