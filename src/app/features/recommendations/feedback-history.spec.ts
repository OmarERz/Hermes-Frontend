import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { provideFakeSession } from '../../testing/fake-session';
import { FeedbackHistory } from './feedback-history';
import { FEEDBACK_ENTRY, RECOMMENDATION } from './recommendation.fixtures';
import { RecommendationsService } from './recommendations.service';

class FakeService {
  feedback = vi.fn<RecommendationsService['feedback']>(() =>
    of([
      FEEDBACK_ENTRY,
      {
        ...FEEDBACK_ENTRY,
        user: 'Luis',
        channel: 'slack' as const,
        verdict: 'stop_suggestions',
        proposed_level: null,
        proposed_score: null,
        comment: '<b>ya no</b>',
        active: false,
        on_older_version: true,
      },
    ]),
  );
}

async function render(service: FakeService) {
  TestBed.configureTestingModule({
    providers: [{ provide: RecommendationsService, useValue: service }, ...provideFakeSession()],
  });
  const fixture = TestBed.createComponent(FeedbackHistory);
  fixture.componentRef.setInput('assessmentId', RECOMMENDATION.assessment_id);
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('FeedbackHistory', () => {
  it('lists the feedback of the front and of Slack with the current one marked', async () => {
    const service = new FakeService();
    const { element } = await render(service);
    expect(service.feedback).toHaveBeenCalledWith(RECOMMENDATION.assessment_id);
    const items = Array.from(element.querySelectorAll('li'));
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Prioridad incorrecta');
    expect(items[0].textContent).toContain('Ana López · Front');
    expect(items[0].textContent).toContain('Vigente');
    expect(items[0].textContent).toContain('Nivel propuesto: Crítica');
    expect(items[0].textContent).toContain('puntaje propuesto: 92');
    expect(items[1].textContent).toContain('No sugerir más');
    expect(items[1].textContent).toContain('Luis · Slack');
    expect(items[1].textContent).toContain('Sobre una versión anterior');
    expect(items[1].textContent).not.toContain('Vigente');
  });

  it('shows the comment as text, never as markup', async () => {
    const { element } = await render(new FakeService());
    const comment = element.querySelectorAll('.entry-comment')[1];
    expect(comment.textContent).toBe('<b>ya no</b>');
    expect(comment.querySelector('b')).toBeNull();
  });

  it('reads the history again when the page bumps its revision', async () => {
    const service = new FakeService();
    const { fixture } = await render(service);
    fixture.componentRef.setInput('revision', 1);
    await fixture.whenStable();
    expect(service.feedback).toHaveBeenCalledTimes(2);
  });

  it('says when there is no feedback and shows errors with a retry', async () => {
    const service = new FakeService();
    service.feedback.mockReturnValueOnce(of([]));
    const { fixture, element } = await render(service);
    expect(element.textContent).toContain('Nadie ha dado feedback sobre esta evaluación.');

    service.feedback.mockReturnValueOnce(
      throwError(() => new ApiError(403, 'forbidden', 'No tienes permiso.')),
    );
    fixture.componentRef.setInput('revision', 1);
    await fixture.whenStable();
    expect(element.textContent).toContain('No tienes permiso.');
    (element.querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(element.querySelectorAll('li')).toHaveLength(2);
  });
});
