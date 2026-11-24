import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../core/config/app-config';
import { ItopLink, itopCreateUrl, itopObjectUrl, safeExternalUrl } from './itop-links';

describe('iTop link helpers', () => {
  const base = 'https://itop.hermes.test/itop';

  it('builds the details, edit and create pages of the console', () => {
    expect(itopObjectUrl(base, 'Server', 12)).toBe(
      'https://itop.hermes.test/itop/pages/UI.php?operation=details&class=Server&id=12',
    );
    expect(itopObjectUrl(base, 'Server', 12, 'edit')).toBe(
      'https://itop.hermes.test/itop/pages/UI.php?operation=modify&class=Server&id=12',
    );
    expect(itopCreateUrl(`${base}/`, 'PC')).toBe(
      'https://itop.hermes.test/itop/pages/UI.php?operation=new&class=PC',
    );
  });

  it('encodes values and refuses a missing console, class or id', () => {
    expect(itopObjectUrl(base, 'Server&x=1', 'a b')).toBe(
      'https://itop.hermes.test/itop/pages/UI.php?operation=details&class=Server%26x%3D1&id=a+b',
    );
    expect(itopObjectUrl(null, 'Server', 1)).toBeNull();
    expect(itopObjectUrl(base, '', 1)).toBeNull();
    expect(itopCreateUrl(base, '')).toBeNull();
  });

  it.each([
    ['javascript:alert(1)', null],
    ['data:text/html,x', null],
    ['https://user:pw@itop.test/', null],
    ['/relative', null],
    [42, null],
    ['https://itop.test/pages/UI.php?id=1', 'https://itop.test/pages/UI.php?id=1'],
  ])('safeExternalUrl(%j) is %j', (value, expected) => {
    expect(safeExternalUrl(value)).toBe(expected);
  });
});

@Component({
  imports: [ItopLink],
  template: `
    <app-itop-link class="direct" kind="edit" href="https://itop.test/pages/UI.php?id=7" />
    <app-itop-link class="built" kind="create" itopClass="Server" />
    <app-itop-link class="unsafe" href="javascript:alert(1)" />
  `,
})
class Host {}

describe('ItopLink', () => {
  it('renders safe links that open in a new tab and nothing for unsafe ones', async () => {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [{ provide: APP_CONFIG, useValue: { itopBaseUrl: 'https://itop.test' } }],
    });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const direct = element.querySelector('.direct a') as HTMLAnchorElement;
    expect(direct.textContent).toContain('Editar en iTop');
    expect(direct.getAttribute('href')).toBe('https://itop.test/pages/UI.php?id=7');
    expect(direct.getAttribute('rel')).toBe('noopener noreferrer');
    expect(direct.getAttribute('target')).toBe('_blank');
    expect((element.querySelector('.built a') as HTMLAnchorElement).getAttribute('href')).toBe(
      'https://itop.test/pages/UI.php?operation=new&class=Server',
    );
    expect(element.querySelector('.unsafe a')).toBeNull();
  });
});
