import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SessionService, SessionStatus } from '../../core/auth/session.service';
import { Login } from './login';

class FakeSession {
  readonly status = signal<SessionStatus>('signed-out');
  readonly notice = signal('');
  loginAvailable = true;
  signIn = vi.fn<SessionService['signIn']>(async () => 'ready');
  retryProfile = vi.fn<SessionService['retryProfile']>(async () => 'ready');
}

async function render(session: FakeSession) {
  TestBed.configureTestingModule({
    imports: [Login],
    providers: [provideRouter([]), { provide: SessionService, useValue: session }],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(Login);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const retryButton = () =>
    Array.from(element.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reintentar con la sesión actual'),
    );
  return { fixture, element, navigate, retryButton };
}

describe('Login', () => {
  it('offers the retry only after a transient profile failure, with its reason', async () => {
    const session = new FakeSession();
    session.status.set('profile-error');
    session.notice.set('El servicio de identidad no responde; intenta más tarde.');
    const { element, retryButton } = await render(session);
    expect(retryButton()).toBeDefined();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'El servicio de identidad no responde',
    );
  });

  it('does not offer the retry without a kept session', async () => {
    const { retryButton } = await render(new FakeSession());
    expect(retryButton()).toBeUndefined();
  });

  it('goes to the start screen when the retry loads the profile', async () => {
    const session = new FakeSession();
    session.status.set('profile-error');
    const { fixture, navigate, retryButton } = await render(session);
    retryButton()?.click();
    await fixture.whenStable();
    expect(session.retryProfile).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/inicio']);
  });

  it('shows the reason again when the retry fails', async () => {
    const session = new FakeSession();
    session.status.set('profile-error');
    session.retryProfile.mockImplementation(async () => {
      session.notice.set('No se pudo conectar con el servidor.');
      return 'profile-error';
    });
    const { fixture, element, navigate, retryButton } = await render(session);
    retryButton()?.click();
    await fixture.whenStable();
    expect(navigate).not.toHaveBeenCalled();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'No se pudo conectar con el servidor.',
    );
  });
});
