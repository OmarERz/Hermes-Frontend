import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import type { Role } from '../../core/api/api-types';
import { provideFakeSession } from '../../testing/fake-session';
import { SetupReminder } from './setup-reminder';
import type { SetupStep } from './setup-steps';
import { SetupService } from './setup.service';

const step = (n: number, done = false, skipped = false): SetupStep => ({
  n,
  name: `Paso ${n}`,
  done,
  skipped,
});

async function render(role: Role, status = vi.fn(() => of([step(1, true), step(2), step(3)]))) {
  TestBed.configureTestingModule({
    imports: [SetupReminder],
    providers: [
      provideRouter([]),
      ...provideFakeSession(role),
      { provide: SetupService, useValue: { status } },
    ],
  });
  const fixture = TestBed.createComponent(SetupReminder);
  await fixture.whenStable();
  return { element: fixture.nativeElement as HTMLElement, status };
}

const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('SetupReminder', () => {
  it('tells an admin how many setup steps are pending, with a link to the wizard', async () => {
    const { element } = await render('admin');
    expect(text(element.querySelector('p'))).toBe(
      'La configuración inicial no está completa. 2 de 3 pasos pendientes en el asistente.',
    );
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/asistente');
    expect(text(element.querySelector('a'))).toBe('Abrir el asistente');
  });

  it('says Hermes is not configured when nothing is done or skipped yet', async () => {
    const { element } = await render(
      'admin',
      vi.fn(() => of([step(1), step(2)])),
    );
    expect(text(element.querySelector('strong'))).toBe('Hermes todavía no está configurado.');
  });

  it('shows nothing once every step is done or skipped, or when the steps cannot be read', async () => {
    const done = await render(
      'admin',
      vi.fn(() => of([step(1, true), step(2, false, true)])),
    );
    expect(done.element.querySelector('aside')).toBeNull();

    TestBed.resetTestingModule();
    const failed = await render(
      'admin',
      vi.fn(() => throwError(() => new ApiError(503, 'auth_unavailable', 'Sin servicio.'))),
    );
    expect(failed.element.querySelector('aside')).toBeNull();
  });

  it('never calls the API for other roles', async () => {
    const { element, status } = await render('analyst');
    expect(status).not.toHaveBeenCalled();
    expect(element.querySelector('aside')).toBeNull();
  });
});
