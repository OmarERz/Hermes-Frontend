import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { provideFakeSession } from '../../testing/fake-session';
import type { FeedbackRequest, FeedbackResult, LevelBands, Recommendation } from './feedback';
import { FeedbackDialog } from './feedback-dialog';
import { BANDS, recommendation, RECOMMENDATION } from './recommendation.fixtures';
import { RecommendationsService } from './recommendations.service';

const RESULT: FeedbackResult = {
  feedback_id: '0192f3a5-1c2d-7e3f-9a4b-5c6d7e8f9a0b',
  replaced_previous: false,
};

class FakeService {
  levelBands = vi.fn<RecommendationsService['levelBands']>(() => of(BANDS));
  send = vi.fn<RecommendationsService['send']>(() => of(RESULT));
}

async function render(service: FakeService, rec: Recommendation = RECOMMENDATION) {
  TestBed.configureTestingModule({
    providers: [
      { provide: RecommendationsService, useValue: service },
      ...provideFakeSession('analyst'),
    ],
  });
  const fixture = TestBed.createComponent(FeedbackDialog);
  fixture.componentRef.setInput('recommendation', rec);
  const saved = vi.fn<(result: FeedbackResult) => void>();
  const closed = vi.fn<() => void>();
  fixture.componentInstance.saved.subscribe(saved);
  fixture.componentInstance.closed.subscribe(closed);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const settle = () => fixture.whenStable();
  const pick = async (label: string) => {
    const option = Array.from(element.querySelectorAll('.decision-option')).find(
      (node) => node.querySelector('strong')?.textContent === label,
    );
    (option?.querySelector('input') as HTMLInputElement).click();
    await settle();
  };
  const type = async (selector: string, value: string) => {
    const field = element.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    await settle();
  };
  const click = async (selector: string) => {
    (element.querySelector(selector) as HTMLButtonElement).click();
    await settle();
  };
  const error = () => element.querySelector('.review-error')?.textContent?.trim() ?? '';
  return { fixture, element, saved, closed, pick, type, click, error };
}

const sentBody = (service: FakeService): FeedbackRequest => service.send.mock.calls[0][0];

describe('FeedbackDialog', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the evaluation, its scores and the six decisions', async () => {
    const service = new FakeService();
    const { element } = await render(service);
    expect(service.levelBands).toHaveBeenCalledTimes(1);
    expect(element.querySelector('.review-case-context')?.textContent).toContain('CVE-2026-10001');
    expect(element.querySelector('app-chip.dialog-level')?.textContent).toBe('Alta');
    expect(
      Array.from(element.querySelectorAll('.score-stages strong')).map((n) => n.textContent),
    ).toEqual(['74', '+12', '86']);
    expect(
      Array.from(element.querySelectorAll('.decision-option strong')).map((n) => n.textContent),
    ).toEqual([
      'Relevante',
      'Falso positivo',
      'Prioridad incorrecta',
      'Investigando',
      'No sugerir más',
      'Aceptar puntaje original',
    ]);
    expect(element.textContent).toContain('Ticket a la vista: 1234');
  });

  it.each([
    ['Relevante', 'relevant'],
    ['Falso positivo', 'false_positive'],
    ['Investigando', 'investigating'],
    ['No sugerir más', 'stop_suggestions'],
  ])('sends «%s» with the ticket on view and the comment, then closes', async (label, verdict) => {
    const service = new FakeService();
    const { pick, type, click, saved, closed } = await render(service);
    await pick(label);
    await type('textarea', 'Revisado con Plataforma.');
    await click('.review-save');
    expect(sentBody(service)).toEqual({
      assessment_id: RECOMMENDATION.assessment_id,
      verdict,
      ticket_itop_id: '1234',
      comment: 'Revisado con Plataforma.',
    });
    expect(saved).toHaveBeenCalledWith(RESULT);
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('asks for a verdict before sending', async () => {
    const service = new FakeService();
    const { click, error } = await render(service);
    await click('.review-save');
    expect(error()).toBe('Elige un veredicto.');
    expect(service.send).not.toHaveBeenCalled();
  });

  it('moves the level one step per click and sends it with the optional score', async () => {
    const service = new FakeService();
    const { element, pick, click, type, error } = await render(service);
    await pick('Prioridad incorrecta');
    expect(element.querySelector('.level-picker strong')?.textContent).toBe('Alta');
    await click('.review-save');
    expect(error()).toMatch(/flechas/);
    expect(service.send).not.toHaveBeenCalled();

    await click('[aria-label="Subir un nivel"]');
    expect(element.querySelector('.level-picker strong')?.textContent).toBe('Crítica');
    expect(
      (element.querySelector('[aria-label="Subir un nivel"]') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(error()).toBe('');
    await type('input[type="number"]', '95');
    await click('.review-save');
    expect(sentBody(service)).toEqual({
      assessment_id: RECOMMENDATION.assessment_id,
      verdict: 'wrong_priority',
      proposed_level: 'critical',
      proposed_score: 95,
      ticket_itop_id: '1234',
    });
  });

  it('refuses a score outside 0 to 100', async () => {
    const service = new FakeService();
    const { pick, click, type, error } = await render(service);
    await pick('Prioridad incorrecta');
    await click('[aria-label="Bajar un nivel"]');
    await type('input[type="number"]', '150');
    await click('.review-save');
    expect(error()).toMatch(/entero de 0 a 100/);
    expect(service.send).not.toHaveBeenCalled();
  });

  it('sends «Aceptar puntaje original» as wrong_priority with the base score and its level', async () => {
    const service = new FakeService();
    const { element, pick, click } = await render(service);
    await pick('Aceptar puntaje original');
    expect(element.querySelector('.review-score-diff')?.textContent).toContain(
      'puntaje base 74 (nivel Media, según los niveles vigentes de la configuración)',
    );
    await click('.review-save');
    expect(sentBody(service)).toEqual({
      assessment_id: RECOMMENDATION.assessment_id,
      verdict: 'wrong_priority',
      proposed_level: 'medium',
      proposed_score: 74,
      ticket_itop_id: '1234',
    });
  });

  it('explains when the original score cannot be accepted', async () => {
    const service = new FakeService();
    const { pick, click, error } = await render(
      service,
      recommendation({ judge_adjustment: 0, final: 74, level: 'medium' }),
    );
    await pick('Aceptar puntaje original');
    expect(error()).toMatch(/no ajustó/);
    await click('.review-save');
    expect(service.send).not.toHaveBeenCalled();
  });

  it('waits for the level bands and says when they cannot be read', async () => {
    const service = new FakeService();
    const bands = new Subject<LevelBands | null>();
    service.levelBands.mockReturnValueOnce(bands);
    const { fixture, element, pick, click, error } = await render(service);
    await pick('Aceptar puntaje original');
    expect(element.textContent).toContain('Leyendo los niveles de la configuración');
    await click('.review-save');
    expect(error()).toMatch(/Todavía se están leyendo/);

    bands.error(new ApiError(503, 'auth_unavailable', 'No responde.'));
    await fixture.whenStable();
    expect(error()).toMatch(/No se pudieron leer los niveles/);
    expect(service.send).not.toHaveBeenCalled();
  });

  it('keeps the dialog open with the API message when the save fails', async () => {
    const service = new FakeService();
    service.send.mockReturnValueOnce(
      throwError(() => new ApiError(403, 'forbidden', 'No tienes permiso para dar feedback.')),
    );
    const { element, pick, click, error, saved, closed } = await render(service);
    await pick('Relevante');
    await click('.review-save');
    expect(error()).toBe('No tienes permiso para dar feedback.');
    // In the docked footer, next to «Guardar feedback», not at the end of the scrolling body (REC-6).
    expect(element.querySelector('.review-modal-actions .review-error')?.getAttribute('role')).toBe(
      'alert',
    );
    expect(saved).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
  });

  it('blocks the actions while the feedback is being saved', async () => {
    const service = new FakeService();
    const pending = new Subject<FeedbackResult>();
    service.send.mockReturnValueOnce(pending);
    const { element, fixture, pick, click, saved, closed } = await render(service);
    await pick('Investigando');
    await click('.review-save');
    expect(element.querySelector('.review-save')?.textContent?.trim()).toBe('Guardando…');
    expect((element.querySelector('.review-cancel') as HTMLButtonElement).disabled).toBe(true);
    fixture.componentInstance.close();
    fixture.componentInstance.save();
    expect(closed).not.toHaveBeenCalled();
    expect(service.send).toHaveBeenCalledTimes(1);

    pending.next({ ...RESULT, replaced_previous: true });
    await fixture.whenStable();
    expect(saved).toHaveBeenCalledWith({ ...RESULT, replaced_previous: true });
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('closes at once when nothing was chosen, and asks first when there is a draft', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const service = new FakeService();
    const first = await render(service);
    await first.click('.review-cancel');
    expect(confirm).not.toHaveBeenCalled();
    expect(first.closed).toHaveBeenCalledTimes(1);
    TestBed.resetTestingModule();

    const second = await render(service);
    await second.pick('Relevante');
    await second.click('.review-close');
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(second.closed).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    const escape = new Event('cancel', { cancelable: true });
    second.element.querySelector('dialog')?.dispatchEvent(escape);
    await second.fixture.whenStable();
    expect(escape.defaultPrevented).toBe(true);
    expect(second.closed).toHaveBeenCalledTimes(1);
  });

  it('opens again when the browser closes it mid-save, and closes once the save settles', async () => {
    const service = new FakeService();
    const pending = new Subject<FeedbackResult>();
    service.send.mockReturnValueOnce(pending);
    const { element, fixture, pick, click, saved, closed } = await render(service);
    await pick('Relevante');
    await click('.review-save');
    const dialog = element.querySelector('dialog') as HTMLDialogElement;
    dialog.removeAttribute('open');
    dialog.dispatchEvent(new Event('close'));
    await fixture.whenStable();
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(closed).not.toHaveBeenCalled();

    pending.next(RESULT);
    await fixture.whenStable();
    expect(saved).toHaveBeenCalledWith(RESULT);
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('asks before the browser discards a draft, and closes at once without one', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const service = new FakeService();
    const first = await render(service);
    const nativeClose = async (target: typeof first) => {
      const dialog = target.element.querySelector('dialog') as HTMLDialogElement;
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
      await target.fixture.whenStable();
      return dialog;
    };
    await nativeClose(first);
    expect(confirm).not.toHaveBeenCalled();
    expect(first.closed).toHaveBeenCalledTimes(1);
    TestBed.resetTestingModule();

    const second = await render(service);
    await second.pick('Investigando');
    const dialog = await nativeClose(second);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(second.closed).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await nativeClose(second);
    expect(second.closed).toHaveBeenCalledTimes(1);
  });

  it('says the ticket-level verdicts apply to every ticket when none is on view', async () => {
    const service = new FakeService();
    const { element, pick, click } = await render(service, recommendation({ ticket_url: null }));
    expect(element.textContent).toContain('se aplican a todos sus tickets');
    await pick('Falso positivo');
    await click('.review-save');
    expect(sentBody(service)).toEqual({
      assessment_id: RECOMMENDATION.assessment_id,
      verdict: 'false_positive',
    });
  });
});
