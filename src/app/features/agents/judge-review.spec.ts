import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { provideFakeSession } from '../../testing/fake-session';
import { ASSESSMENT_ID, FEEDBACK_ENTRY, JUDGE_DETAIL } from './agents.fixtures';
import { AgentsService } from './agents.service';
import { adjustmentText, doubleReviewText, JudgeReview } from './judge-review';

class FakeService {
  judge = vi.fn<AgentsService['judge']>(() => of(JUDGE_DETAIL));
  feedback = vi.fn<AgentsService['feedback']>(() => of([FEEDBACK_ENTRY]));
}

@Component({
  imports: [JudgeReview],
  template: '<app-judge-review [assessmentId]="id()" />',
})
class Host {
  readonly id = signal(ASSESSMENT_ID);
}

async function render(service: FakeService) {
  TestBed.configureTestingModule({
    imports: [Host],
    providers: [
      { provide: AgentsService, useValue: service },
      ...provideFakeSession('reader'),
      provideRouter([]),
    ],
  });
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

const text = (node: Element | null | undefined) =>
  (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

function facts(element: HTMLElement): Record<string, string> {
  const terms = Array.from(element.querySelectorAll('dt'));
  return Object.fromEntries(terms.map((term) => [text(term), text(term.nextElementSibling)]));
}

describe('JudgeReview', () => {
  it('shows the decision, the adjustment, the double review and the mitigation', async () => {
    const { element } = await render(new FakeService());
    const shown = facts(element);
    expect(shown['Resultado']).toBe('Aplicada');
    expect(shown['Resumen']).toBe('Explotación masiva confirmada en dos fuentes.');
    expect(shown['Modelo']).toBe('opus');
    expect(shown['Ajuste']).toBe('Propuesto +8 · aplicado +8');
    expect(shown['Doble revisión']).toBe('Coincidieron · primera +8 · segunda +7 (Aplicada)');
    expect(shown['Mitigación']).toBe('Aceptada (redactada por IA)');
  });

  it('lists the accepted and rejected reasons with their points, rule and quote as text', async () => {
    const { element } = await render(new FakeService());
    const [first, second] = Array.from(element.querySelectorAll('.reason:not(.rejected)'));
    expect(text(first)).toContain('Explotación masiva · +6 puntos');
    // The quote is external text: shown escaped, never as HTML (SEG-02).
    expect(first.querySelector('q')?.textContent).toBe('<b>exploited in the wild</b>');
    expect(first.querySelector('q b')).toBeNull();
    expect(text(second)).toContain('· CI SRV-01');
    const rejected = element.querySelector('.reason.rejected')!;
    expect(text(rejected)).toContain(
      'Ransomware · Rechazado por una regla (regla L5.quote) · +5 puntos propuestos',
    );
  });

  it('lists the feedback people gave and links the recommendation', async () => {
    const service = new FakeService();
    service.feedback.mockReturnValue(
      of([
        FEEDBACK_ENTRY,
        {
          ...FEEDBACK_ENTRY,
          user: 'Luis',
          verdict: 'false_positive',
          channel: 'slack',
          active: false,
          on_older_version: true,
        },
      ]),
    );
    const { element } = await render(service);
    const lines = Array.from(element.querySelectorAll('.feedback-list li')).map(text);
    expect(lines[0]).toMatch(/^Ana Analista: Relevante · .* · desde front$/);
    expect(lines[1]).toContain('Luis: Falso positivo');
    expect(lines[1]).toContain('desde Slack');
    expect(lines[1]).toContain('Reemplazado');
    expect(lines[1]).toContain('Sobre una versión anterior');
    expect(element.querySelector('.recommendation-link')?.getAttribute('href')).toBe(
      `/recomendaciones-agente?id=${ASSESSMENT_ID}`,
    );
  });

  it('says when nobody gave feedback and when there were no reasons', async () => {
    const service = new FakeService();
    service.feedback.mockReturnValue(of([]));
    service.judge.mockReturnValue(
      of({
        ...JUDGE_DETAIL,
        status: null,
        summary: null,
        model: null,
        reviewed_at: null,
        review_id: null,
        proposed_adjustment: null,
        applied_adjustment: 0,
        accepted_reasons: [],
        rejected_reasons: [],
        double_review: null,
        mitigation_status: null,
      }),
    );
    const { element } = await render(service);
    const shown = facts(element);
    expect(shown['Resultado']).toBe('La evaluación no tuvo juez');
    expect(shown['Ajuste']).toBe('Aplicado 0');
    expect(shown['Doble revisión']).toBe('No hubo');
    expect(shown['Motivos aceptados']).toBe('Ninguno');
    expect(shown['Motivos rechazados']).toBe('Ninguno');
    expect(shown['Mitigación']).toBe('—');
    expect(text(element.querySelector('.feedback-list'))).toBe(
      'Nadie ha dado feedback sobre esta evaluación.',
    );
  });

  it('loads the judge detail and the feedback again for another evaluation', async () => {
    const service = new FakeService();
    const { fixture } = await render(service);
    fixture.componentInstance.id.set('0196a6f0-0000-7000-8000-000000000002');
    await fixture.whenStable();
    expect(service.judge).toHaveBeenLastCalledWith('0196a6f0-0000-7000-8000-000000000002');
    expect(service.feedback).toHaveBeenLastCalledWith('0196a6f0-0000-7000-8000-000000000002');
  });

  it('shows each error with its own retry', async () => {
    const service = new FakeService();
    service.judge.mockReturnValue(
      throwError(() => new ApiError(404, 'not_found', 'La evaluación no existe.')),
    );
    service.feedback.mockReturnValue(
      throwError(() => new ApiError(500, 'internal_error', 'Feedback no disponible.')),
    );
    const { fixture, element } = await render(service);
    const [judgeAlert, feedbackAlert] = Array.from(element.querySelectorAll('[role="alert"]'));
    expect(judgeAlert.textContent).toContain('La evaluación no existe.');
    expect(feedbackAlert.textContent).toContain('Feedback no disponible.');

    service.judge.mockReturnValue(of(JUDGE_DETAIL));
    service.feedback.mockReturnValue(of([]));
    (judgeAlert.querySelector('button') as HTMLButtonElement).click();
    (feedbackAlert.querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(service.judge).toHaveBeenCalledTimes(2);
    expect(service.feedback).toHaveBeenCalledTimes(2);
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });
});

describe('judge review texts', () => {
  it('says when the dead zone stopped the adjustment', () => {
    expect(
      adjustmentText({
        ...JUDGE_DETAIL,
        proposed_adjustment: 3,
        applied_adjustment: 0,
        dead_zone_applied: true,
      }),
    ).toBe('Propuesto +3 · aplicado 0 (cayó en la zona muerta y no se aplicó)');
  });

  it('describes a double review that disagreed or was not decided', () => {
    const double = JUDGE_DETAIL.double_review!;
    expect(
      doubleReviewText({
        ...JUDGE_DETAIL,
        double_review: {
          ...double,
          agreed: false,
          second_adjustment: null,
          second_status: 'rejected',
        },
      }),
    ).toBe(
      'No coincidieron: final = base · primera +8 · segunda sin ajuste (Rechazada por la validación)',
    );
    expect(
      doubleReviewText({
        ...JUDGE_DETAIL,
        double_review: { ...double, agreed: null, first_adjustment: null },
      }),
    ).toBe('Sin decidir (la revisión quedó obsoleta) · primera sin ajuste · segunda +7 (Aplicada)');
  });
});
