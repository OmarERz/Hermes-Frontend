import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import type { Role } from '../../core/api/api-types';
import { provideFakeSession } from '../../testing/fake-session';
import type { CompanyProfile } from './company-labels';
import { CompanyService } from './company.service';
import { CompanyPage } from './company.page';
import { ProfilePanel, profileChanges } from './profile-panel';

const PROFILE: CompanyProfile = {
  sector: 'fintech',
  subsectors: ['retail'],
  countries: ['MX'],
  language: 'es',
  version: 4,
};

class FakeCompany {
  getProfile = vi.fn<() => Observable<CompanyProfile>>(() => of(PROFILE));
  updateProfile = vi.fn<CompanyService['updateProfile']>((update) => {
    const { expected_version, ...rest } = update;
    return of({ ...rest, version: expected_version + 1 });
  });
  listPeers = vi.fn<CompanyService['listPeers']>(() => of({ items: [], nextCursor: null }));
  createPeer = vi.fn<CompanyService['createPeer']>();
  updatePeer = vi.fn<CompanyService['updatePeer']>();
  deletePeer = vi.fn<CompanyService['deletePeer']>();
}

async function render(role: Role = 'admin', service = new FakeCompany()) {
  TestBed.configureTestingModule({
    imports: [ProfilePanel],
    providers: [{ provide: CompanyService, useValue: service }, ...provideFakeSession(role)],
  });
  const fixture = TestBed.createComponent(ProfilePanel);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const click = async (selector: string) => {
    element.querySelector<HTMLButtonElement>(selector)!.click();
    await fixture.whenStable();
  };
  return { fixture, element, service, panel: fixture.componentInstance, click };
}

const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
/** «Term value» of one fact of the read-only view. */
const fact = (element: Element) =>
  `${text(element.querySelector('dt'))} ${text(element.querySelector('dd'))}`;

describe('ProfilePanel', () => {
  it('shows the profile in Spanish and hides the edit button from non-admins', async () => {
    const { element } = await render('analyst');
    const facts = Array.from(element.querySelectorAll('.facts div')).map(fact);
    expect(facts).toEqual([
      'Sector principal Tecnología financiera',
      'Subsectores Comercio',
      'Países de operación México (MX)',
      'Idioma de salida Español',
    ]);
    expect(text(element.querySelector('.inventory > header'))).toContain('Versión 4');
    expect(element.querySelector('.panel-action')).toBeNull();
  });

  it('confirms the changes and saves them with the version it read', async () => {
    const { fixture, element, service, panel, click } = await render();
    await click('.panel-action');
    panel.setSector('retail');
    expect(panel.subsectors()).toEqual([]);
    panel.countryInput.set('co');
    panel.addCountry();
    await fixture.whenStable();
    expect(text(element.querySelector('.chips'))).toContain('Colombia (CO)');

    await click('button[type="submit"]');
    const dialog = element.querySelector('[role="dialog"]')!;
    expect(Array.from(dialog.querySelectorAll('h3')).map(text)).toEqual([
      'Sector principal',
      'Subsectores',
      'Países de operación',
    ]);
    expect(text(dialog)).toContain('Colombia (CO), México (MX)');
    expect(service.updateProfile).not.toHaveBeenCalled();

    await click('[role="dialog"] .save-button');
    expect(service.updateProfile).toHaveBeenCalledWith({
      sector: 'retail',
      subsectors: [],
      countries: ['CO', 'MX'],
      language: 'es',
      expected_version: 4,
    });
    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(text(element.querySelector('.inventory > header'))).toContain('Versión 5');
    expect(text(element.querySelector('[role="status"]'))).toBe('Perfil guardado.');
  });

  it('rejects bad country codes and repeated countries, and says when nothing changed', async () => {
    const { fixture, element, panel, click } = await render();
    await click('.panel-action');
    panel.countryInput.set('Mexico');
    panel.addCountry();
    panel.countryInput.set('mx');
    await fixture.whenStable();
    expect(text(element.querySelector('#profile-country-error'))).toContain('dos letras');
    panel.addCountry();
    await fixture.whenStable();
    expect(text(element.querySelector('#profile-country-error'))).toBe(
      'México ya está en la lista.',
    );

    await click('button[type="submit"]');
    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(text(element.querySelector('.form-note'))).toBe('No hay cambios que guardar.');
  });

  it('offers to reload when someone else saved in between', async () => {
    const service = new FakeCompany();
    service.updateProfile.mockReturnValueOnce(
      throwError(
        () =>
          new ApiError(
            409,
            'version_conflict',
            'El perfil cambió desde que lo leíste; vuelve a cargarlo.',
          ),
      ),
    );
    const { element, panel, click } = await render('admin', service);
    await click('.panel-action');
    panel.language.set('en');
    await click('button[type="submit"]');
    await click('[role="dialog"] .save-button');
    expect(text(element.querySelector('[role="dialog"] [role="alert"]'))).toContain(
      'Alguien guardó cambios mientras editabas',
    );

    service.getProfile.mockReturnValueOnce(of({ ...PROFILE, language: 'en', version: 5 }));
    await click('[role="dialog"] .save-button');
    expect(service.getProfile).toHaveBeenCalledTimes(2);
    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(element.querySelector('form')).toBeNull();
    expect(text(element.querySelector('.inventory > header'))).toContain('Versión 5');
  });

  it('asks for a primary sector and keeps the dialog open with an API refusal', async () => {
    const service = new FakeCompany();
    service.getProfile.mockReturnValue(
      of({ sector: '', subsectors: [], countries: [], language: 'es', version: 1 }),
    );
    service.updateProfile.mockReturnValueOnce(
      throwError(
        () =>
          new ApiError(422, 'validation_error', 'El sector no existe en el catálogo.', [
            { field: 'body.sector', issue: 'unknown_sector' },
          ]),
      ),
    );
    const { element, panel, click } = await render('admin', service);
    expect(fact(element.querySelector('.facts div')!)).toBe('Sector principal Sin definir');
    await click('.panel-action');
    await click('button[type="submit"]');
    expect(text(element.querySelector('#profile-sector-error'))).toBe('Elige el sector principal.');
    expect(element.querySelector('[role="dialog"]')).toBeNull();

    panel.setSector('government');
    await click('button[type="submit"]');
    await click('[role="dialog"] .save-button');
    expect(text(element.querySelector('[role="dialog"] [role="alert"]'))).toBe(
      'El sector no existe en el catálogo.',
    );
  });

  it('shows the loading state, then the API message with a retry', async () => {
    const service = new FakeCompany();
    const pending = new Subject<CompanyProfile>();
    service.getProfile.mockReturnValueOnce(pending);
    const { fixture, element } = await render('reader', service);
    expect(text(element.querySelector('[role="status"]'))).toBe('Cargando el perfil…');
    pending.error(new ApiError(500, 'internal_error', 'Ocurrió un error en el servidor.'));
    await fixture.whenStable();
    expect(text(element.querySelector('[role="alert"]'))).toContain(
      'Ocurrió un error en el servidor.',
    );
    element.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await fixture.whenStable();
    expect(element.querySelectorAll('.facts div')).toHaveLength(4);
  });

  it('offers to edit only once the profile is read, never during or after a failed reload', async () => {
    const service = new FakeCompany();
    const { fixture, element, panel } = await render('admin', service);
    const pending = new Subject<CompanyProfile>();
    service.getProfile.mockReturnValueOnce(pending);
    panel.reload();
    await fixture.whenStable();
    expect(element.querySelector('.panel-action')).toBeNull();
    panel.startEdit();
    expect(panel.editing()).toBe(false);

    pending.error(new ApiError(500, 'internal_error', 'Ocurrió un error en el servidor.'));
    await fixture.whenStable();
    expect(element.querySelector('.panel-action')).toBeNull();

    service.getProfile.mockReturnValueOnce(of({ ...PROFILE, version: 5 }));
    element.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await fixture.whenStable();
    expect(element.querySelector('.panel-action')).not.toBeNull();
    expect(text(element.querySelector('.inventory > header'))).toContain('Versión 5');
  });

  it('lists only the fields that change', () => {
    const before = {
      sector: 'fintech',
      subsectors: ['retail'],
      countries: ['MX', 'CO'],
      language: 'es',
    };
    expect(profileChanges(before, { ...before, countries: ['CO', 'MX'] })).toEqual([]);
    expect(profileChanges(before, { ...before, language: 'en' })).toEqual([
      { name: 'Idioma de salida', before: 'Español', after: 'Inglés' },
    ]);
  });
});

describe('CompanyPage', () => {
  it('shows the profile summary in the stat cards', async () => {
    TestBed.configureTestingModule({
      imports: [CompanyPage],
      providers: [
        { provide: CompanyService, useValue: new FakeCompany() },
        ...provideFakeSession('reader'),
      ],
    });
    const fixture = TestBed.createComponent(CompanyPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toContain('Empresa');
    expect(Array.from(element.querySelectorAll('.kpi-value')).map(text)).toEqual([
      'Tecnología financiera',
      '1',
      '1',
      'Español',
    ]);
  });
});
