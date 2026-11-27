import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideFakeSession } from '../../testing/fake-session';
import { ThemeService } from '../../core/theme/theme.service';
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

async function open() {
  const rendered = await render();
  rendered.trigger.click();
  rendered.fixture.detectChanges();
  await rendered.fixture.whenStable();
  const panel = rendered.element.querySelector<HTMLElement>('.profile-dropdown')!;
  const button = (name: string) =>
    [...panel.querySelectorAll<HTMLButtonElement>('button')].find((item) => text(item) === name)!;
  return { ...rendered, panel, button };
}

function pressTab(target: HTMLElement, shiftKey = false) {
  target.focus();
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true }));
}

describe('MenuPerfil theme switch', () => {
  it('switches the theme from the menu and keeps the menu open', async () => {
    const { fixture, element, button } = await open();
    const theme = TestBed.inject(ThemeService);
    expect(theme.theme()).toBe('dark');

    button('Cambiar a tema claro').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(theme.theme()).toBe('light');
    expect(element.querySelector('.profile-dropdown')).not.toBeNull();
    expect(text(element.querySelector('.theme-toggle'))).toBe('Cambiar a tema oscuro');
  });
});

describe('MenuPerfil keyboard', () => {
  it('keeps the menu open while Tab moves between its buttons', async () => {
    const { fixture, element, panel, button } = await open();
    pressTab(panel);
    pressTab(button('Cambiar a tema claro'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.querySelector('.profile-dropdown')).not.toBeNull();
  });

  it('closes when Tab leaves the last button', async () => {
    const { fixture, element, button } = await open();
    pressTab(button('Cerrar sesión'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.querySelector('.profile-dropdown')).toBeNull();
  });

  it('closes when Shift+Tab leaves the first button', async () => {
    const { fixture, element, button } = await open();
    pressTab(button('Cambiar a tema claro'), true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.querySelector('.profile-dropdown')).toBeNull();
  });

  it('ignores the other keys', async () => {
    const { fixture, element, panel } = await open();
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(element.querySelector('.profile-dropdown')).not.toBeNull();
  });
});
