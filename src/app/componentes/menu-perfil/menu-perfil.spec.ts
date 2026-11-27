import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideFakeSession } from '../../testing/fake-session';
import { MenuPerfil } from './menu-perfil';

async function render() {
  TestBed.configureTestingModule({
    imports: [MenuPerfil],
    providers: [...provideFakeSession('admin'), provideRouter([])],
  });
  const fixture = TestBed.createComponent(MenuPerfil);
  fixture.componentInstance.ubicacion = 'arriba';
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const trigger = element.querySelector<HTMLButtonElement>('.profile-trigger')!;
  return { fixture, element, trigger };
}

const text = (node: Element | null) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('MenuPerfil', () => {
  it('names the trigger by its visible name and role plus what it opens', async () => {
    const { trigger } = await render();
    expect(trigger.hasAttribute('aria-label')).toBe(false);
    expect(text(trigger.querySelector('.profile-copy'))).toBe('UsuarioRol: Administrador');
    expect(text(trigger.querySelector('.visually-hidden'))).toBe('Menú del perfil');
    expect(trigger.querySelector('.avatar')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('tells whether the menu is open through aria-expanded', async () => {
    const { fixture, element, trigger } = await render();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(element.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
      'Menú del perfil',
    );
  });
});
