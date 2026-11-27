import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import type { Role } from '../../core/api/api-types';
import { provideFakeSession } from '../../testing/fake-session';
import { makeSource } from './source-fixtures';
import type { Source } from './source-labels';
import { SourcesPage } from './sources.page';
import { SourcesService } from './sources.service';

/** Captured an hour ago, so it counts in «últimas 24 h» whatever day the tests run. */
const RECENT = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const KEV = makeSource({ id: 'kev', name: 'CISA KEV', last_capture: RECENT });
const NVD = makeSource({
  id: 'nvd',
  name: 'NVD',
  last_capture: null,
  items_per_run: 0,
  health: 'failing',
});
const THN = makeSource({
  id: 'thn',
  name: 'The Hacker News',
  type: 'media',
  level: 'N3',
  structural: false,
  active: true,
  last_capture: RECENT,
  health: 'degraded',
});
const FEED = makeSource({
  id: 'feed',
  name: 'Boletín propio',
  type: 'feed',
  level: 'N4',
  structural: false,
  active: false,
  last_capture: null,
  items_per_run: 0,
});

class FakeSources {
  listAll = vi.fn<() => Observable<Source[]>>(() => of([KEV, NVD, THN, FEED]));
  update = vi.fn<SourcesService['update']>((id, change) =>
    of({ ...[KEV, NVD, THN, FEED].find((source) => source.id === id)!, ...change } as Source),
  );
  create = vi.fn<SourcesService['create']>();
}

async function render(role: Role = 'analyst', service = new FakeSources()) {
  TestBed.configureTestingModule({
    imports: [SourcesPage],
    providers: [{ provide: SourcesService, useValue: service }, ...provideFakeSession(role)],
  });
  const fixture = TestBed.createComponent(SourcesPage);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  return { fixture, element, service, page: fixture.componentInstance };
}

const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const all = (root: HTMLElement, selector: string) =>
  Array.from(root.querySelectorAll<HTMLElement>(selector));
const tableNames = (root: HTMLElement) => all(root, 'tbody .row-link').map(text);
/** «Label value» of each details row (the label and the value are adjacent elements). */
const detailRows = (root: HTMLElement) =>
  all(root, '.detail-row').map((row) =>
    Array.from(row.children).map(text).filter(Boolean).join(' '),
  );

describe('SourcesPage', () => {
  it('starts with the shared page banner and the indicators in their own row below it', async () => {
    const { element } = await render();
    const banner = element.querySelector('.feeds-page > app-banner-pagina')!;
    expect(text(banner.querySelector('h1'))).toBe('Fuentes');
    expect(banner.querySelector('.kpi-grid')).toBeNull();
    expect(banner.nextElementSibling?.matches('section.kpi-grid')).toBe(true);
  });

  it('draws the class and level filters as segmented controls that say which one is on', async () => {
    const { element, fixture } = await render();
    const groups = all(element, '.sources-toolbar .segmented[role="group"]');
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
      'Filtrar por clase',
      'Filtrar por nivel',
    ]);
    const pressed = () => all(element, '.segmented [aria-pressed="true"]').map(text);
    expect(pressed()).toEqual(['Todas 4', 'Todos los niveles 4']);
    all(groups[1], 'button')[1].click();
    await fixture.whenStable();
    expect(pressed()).toEqual(['Todas 2', 'N1 2']);
  });

  it('shows the real sources with their totals and never the invented feeds', async () => {
    const { element } = await render();
    expect(all(element, '.kpi-value').map(text)).toEqual(['4', '3', '1', '2']);
    expect(tableNames(element)).toEqual(['CISA KEV', 'NVD', 'The Hacker News', 'Boletín propio']);
    for (const invented of ['AlienVault', 'OTX', 'AbuseIPDB', 'MISP', 'Snyk']) {
      expect(element.textContent).not.toContain(invented);
    }
    const row = all(element, 'tbody tr')[2];
    expect(all(row, 'td').map(text)).toEqual([
      'The Hacker News',
      'Medio',
      'N3',
      'Responde con fallas',
      expect.not.stringMatching(/^(—|Sin capturas todavía)?$/),
      '12',
      'Activa',
    ]);
  });

  it('marks structural sources with a lock and never offers to switch them off', async () => {
    const { element } = await render('admin');
    const center = element.querySelector('.center-card')!;
    expect(text(center)).toContain('CISA KEV');
    // FUE-4: the Lucide lock, not the emoji, outside the table; the level is the shared chip.
    expect(text(center)).not.toContain('🔒');
    expect(text(center.querySelector('.lock-icon'))).toBe('Estructural');
    expect(center.querySelector('.lock-icon svg')).not.toBeNull();
    expect(center.querySelector('app-chip.level-chip')?.getAttribute('data-tone')).toBe('violet');
    expect(center.querySelector('input[role="switch"]')).toBeNull();
    expect(text(center.querySelector('.feed-toggle'))).toBe('Siempre activa');
    expect(center.querySelector('.feed-toggle svg')).not.toBeNull();
    expect(text(all(element, 'tbody tr')[0])).toContain('🔒');
    expect(text(all(element, 'tbody tr')[2])).not.toContain('🔒');
  });

  it('filters by class and by level, with the count of each option', async () => {
    const { fixture, element, page } = await render();
    const typeButtons = all(element, '[aria-label="Filtrar por clase"] button').map(text);
    expect(typeButtons).toEqual([
      'Todas 4',
      'Oficial 2',
      'Investigación 0',
      'Medio 1',
      'Feed propio 1',
    ]);

    page.setLevelFilter('N3');
    await fixture.whenStable();
    expect(tableNames(element)).toEqual(['The Hacker News']);
    expect(all(element, '[aria-label="Filtrar por clase"] button').map(text)[1]).toBe('Oficial 0');
    expect(text(element.querySelector('.center-card'))).toContain('The Hacker News');

    page.setLevelFilter('');
    page.setTypeFilter('official');
    await fixture.whenStable();
    expect(tableNames(element)).toEqual(['CISA KEV', 'NVD']);
    expect(all(element, '[aria-label="Filtrar por nivel"] button').map(text)).toEqual([
      'Todos los niveles 2',
      'N1 2',
      'N2 0',
      'N3 0',
      'N4 0',
    ]);

    page.setTypeFilter('research');
    await fixture.whenStable();
    expect(element.querySelector('.empty-carousel')?.textContent).toContain(
      'No hay fuentes con estos filtros',
    );
  });

  it('switches an optional source and keeps the switch on the server state until it answers', async () => {
    const service = new FakeSources();
    const answer = new Subject<Source>();
    service.update.mockReturnValueOnce(answer);
    const { fixture, element, page } = await render('analyst', service);
    page.carousel.select('feed');
    await fixture.whenStable();

    const toggle = element.querySelector<HTMLInputElement>('.center-card input[role="switch"]')!;
    toggle.click();
    await fixture.whenStable();
    expect(service.update).toHaveBeenCalledWith('feed', { active: true });
    expect(toggle.checked).toBe(false);
    expect(toggle.disabled).toBe(true);

    answer.next({ ...FEED, active: true });
    answer.complete();
    await fixture.whenStable();
    expect(toggle.checked).toBe(true);
    expect(toggle.disabled).toBe(false);
    expect(text(element.querySelector('[role="status"].integration-note'))).toBe(
      'Boletín propio quedó activa.',
    );
    expect(all(element, '.kpi-value').map(text).slice(1, 3)).toEqual(['4', '0']);
  });

  it('shows the API refusal and leaves the source as it was', async () => {
    const service = new FakeSources();
    service.update.mockReturnValueOnce(
      throwError(
        () => new ApiError(403, 'forbidden', 'No tienes permiso para realizar esta acción.'),
      ),
    );
    const { fixture, element, page } = await render('analyst', service);
    page.carousel.select('thn');
    await fixture.whenStable();
    element.querySelector<HTMLInputElement>('.center-card input[role="switch"]')!.click();
    await fixture.whenStable();
    expect(text(element.querySelector('[role="alert"].integration-note'))).toBe(
      'No tienes permiso para realizar esta acción.',
    );
    expect(page.sources().find((source) => source.id === 'thn')?.active).toBe(true);
  });

  it('shows the state without a switch to a reader', async () => {
    const { fixture, element, page } = await render('reader');
    page.carousel.select('thn');
    await fixture.whenStable();
    expect(element.querySelector('input[role="switch"]')).toBeNull();
    expect(text(element.querySelector('.center-card .feed-toggle'))).toBe('Activa');
  });

  it('shows the catalogue fields only when the API sends them', async () => {
    const service = new FakeSources();
    const described = {
      ...THN,
      description: 'Noticias de ciberseguridad.',
      provider: 'The Hacker News',
      refresh_interval_minutes: 60,
    } as Source;
    service.listAll.mockReturnValue(of([KEV, described]));
    const { fixture, element, page } = await render('reader', service);

    const details = () => detailRows(element);
    expect(details().some((line) => /^(Proveedor|Frecuencia)/.test(line))).toBe(false);
    expect(details().join(' ')).not.toContain('No disponible');
    expect(text(element.querySelector('.center-card .feed-description'))).toBe(
      'Oficial (máxima confianza)',
    );

    page.carousel.select('thn');
    await fixture.whenStable();
    expect(details()).toContain('Proveedor The Hacker News');
    expect(details()).toContain('Frecuencia Cada hora');
    expect(text(element.querySelector('.center-card .feed-description'))).toBe(
      'Noticias de ciberseguridad.',
    );
    expect(text(element.querySelector('.source-description'))).toBe('Noticias de ciberseguridad.');
  });

  it('names each carousel card by its visible text, so the spoken name matches what shows', async () => {
    const { element } = await render();
    const cards = all(element, '.feed-card-select');
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.hasAttribute('aria-label')).toBe(false);
      expect(card.querySelector('.feed-brand')?.getAttribute('aria-hidden')).toBe('true');
      expect(text(card.querySelector('.feed-card-heading strong'))).not.toBe('');
    }
  });

  it('selects side cards and the health table rows without switching anything', async () => {
    const { fixture, element, service } = await render();
    const side = all(element, '.side-card .feed-card-select').find((button) =>
      text(button).includes('NVD'),
    )!;
    side.click();
    await fixture.whenStable();
    expect(text(element.querySelector('#feed-details-title'))).toBe('Detalles de la fuente: NVD');
    expect(detailRows(element)).toContain('Última captura Sin capturas todavía');

    all(element, 'tbody .row-link')
      .find((button) => text(button) === 'Boletín propio')!
      .click();
    await fixture.whenStable();
    expect(text(element.querySelector('.center-card'))).toContain('Boletín propio');
    expect(element.querySelector('tr.selected-row')?.textContent).toContain('Boletín propio');
    expect(service.update).not.toHaveBeenCalled();
  });

  it('shows the loading state, then the API message with a retry', async () => {
    const service = new FakeSources();
    const pending = new Subject<Source[]>();
    service.listAll.mockReturnValueOnce(pending);
    const { fixture, element } = await render('reader', service);
    expect(text(element.querySelector('.empty-carousel'))).toBe('Cargando fuentes…');
    expect(all(element, '.kpi-value').map(text)).toEqual([
      'Cargando…',
      'Cargando…',
      'Cargando…',
      'Cargando…',
    ]);

    pending.error(new ApiError(503, 'auth_unavailable', 'El servicio de identidad no responde.'));
    await fixture.whenStable();
    expect(text(element.querySelector('[role="alert"]'))).toContain(
      'El servicio de identidad no responde.',
    );
    element.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await fixture.whenStable();
    expect(tableNames(element)).toHaveLength(4);
  });

  it('lets only an admin change a level, with N1 kept for structural sources', async () => {
    for (const role of ['reader', 'analyst'] as const) {
      TestBed.resetTestingModule();
      const { element } = await render(role);
      expect(element.querySelector('.level-select')).toBeNull();
      expect(element.querySelector('.add-source-button')).toBeNull();
    }
    TestBed.resetTestingModule();
    const { fixture, element, page } = await render('admin');
    const options = () =>
      all(element, '.level-select option').map((option) => (option as HTMLOptionElement).value);
    expect(options()).toEqual(['N1', 'N2', 'N3', 'N4']);
    page.carousel.select('thn');
    await fixture.whenStable();
    expect(options()).toEqual(['N2', 'N3', 'N4']);
    expect(element.querySelector<HTMLSelectElement>('.level-select select')!.value).toBe('N3');
  });

  it('asks to confirm a new level and saves it only after the confirmation', async () => {
    const { fixture, element, page, service } = await render('admin');
    page.carousel.select('thn');
    await fixture.whenStable();
    const select = element.querySelector<HTMLSelectElement>('.level-select select')!;
    select.value = 'N2';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(select.value).toBe('N3');
    expect(service.update).not.toHaveBeenCalled();
    const dialog = element.querySelector('[role="dialog"]')!;
    expect(text(dialog)).toContain('Nivel de confianza de The Hacker News');
    expect(text(dialog)).toContain('N3 · Medios especializados');
    expect(text(dialog)).toContain('N2 · Investigación o proveedor reconocido');

    dialog.querySelector<HTMLButtonElement>('.save-button')!.click();
    await fixture.whenStable();
    expect(service.update).toHaveBeenCalledWith('thn', { level: 'N2' });
    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(element.querySelector<HTMLSelectElement>('.level-select select')!.value).toBe('N2');
    expect(text(element.querySelector('[role="status"].integration-note'))).toBe(
      'The Hacker News quedó en nivel N2.',
    );
  });

  it('keeps the dialog open with the API message when the level is refused', async () => {
    const service = new FakeSources();
    service.update.mockReturnValueOnce(
      throwError(
        () =>
          new ApiError(422, 'validation_error', 'N1 está reservado para fuentes oficiales', [
            { field: 'body', issue: 'source_rule' },
          ]),
      ),
    );
    const { fixture, element, page } = await render('admin', service);
    page.carousel.select('thn');
    await fixture.whenStable();
    const select = element.querySelector<HTMLSelectElement>('.level-select select')!;
    select.value = 'N4';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('[role="dialog"] .save-button')!.click();
    await fixture.whenStable();
    expect(text(element.querySelector('[role="dialog"] [role="alert"]'))).toBe(
      'N1 está reservado para fuentes oficiales',
    );
    expect(page.sources().find((source) => source.id === 'thn')?.level).toBe('N3');
    element.querySelector<HTMLButtonElement>('[role="dialog"] .cancel-button')!.click();
    await fixture.whenStable();
    expect(element.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows a feed the admin adds, selected, with the filters cleared', async () => {
    const { fixture, element, page } = await render('admin');
    page.setTypeFilter('official');
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('.add-source-button')!.click();
    await fixture.whenStable();
    expect(element.querySelector('app-add-source-form')).not.toBeNull();

    page.sourceAdded(
      makeSource({
        id: 'new',
        name: 'Boletín nuevo',
        type: 'feed',
        level: 'N4',
        structural: false,
        active: false,
      }),
    );
    await fixture.whenStable();
    expect(element.querySelector('app-add-source-form')).toBeNull();
    expect(page.typeFilter()).toBe('');
    expect(text(element.querySelector('.center-card'))).toContain('Boletín nuevo');
    expect(tableNames(element)).toContain('Boletín nuevo');
    expect(text(element.querySelector('[role="status"].integration-note'))).toContain(
      'Boletín nuevo se agregó con nivel N4 e inactiva.',
    );
  });

  it('moves the carousel with a swipe or a horizontal wheel, and ignores small moves', async () => {
    const { page } = await render();
    const selected = () => page.carousel.selected()?.id;
    const stage = { hasPointerCapture: vi.fn(() => false), setPointerCapture: vi.fn() };
    const pointer = (clientX: number, extra: Record<string, unknown> = {}) =>
      ({
        pointerId: 1,
        clientX,
        target: null,
        currentTarget: stage,
        ...extra,
      }) as unknown as PointerEvent;
    expect(selected()).toBe('kev');

    page.startDrag(pointer(300));
    page.updateDrag(pointer(290));
    expect(stage.setPointerCapture).not.toHaveBeenCalled();
    page.updateDrag(pointer(200));
    expect(stage.setPointerCapture).toHaveBeenCalledWith(1);
    page.endDrag(pointer(200));
    expect(selected()).toBe('nvd');
    // The click that ends a swipe does not select the card under the pointer.
    page.selectCard('thn', 4);
    expect(selected()).toBe('nvd');

    page.startDrag(pointer(300));
    page.endDrag(pointer(280));
    expect(selected()).toBe('nvd');
    page.startDrag(pointer(300));
    page.updateDrag(pointer(100, { pointerId: 2 }));
    page.endDrag(pointer(500, { pointerId: 2 }));
    expect(selected()).toBe('nvd');
    page.endDrag(pointer(400));
    expect(selected()).toBe('kev');
    page.endDrag(pointer(100));
    expect(selected()).toBe('kev');

    const toggle = document.createElement('label');
    toggle.className = 'feed-toggle';
    page.startDrag(pointer(300, { target: toggle }));
    page.endDrag(pointer(100));
    expect(selected()).toBe('kev');

    const wheel = (deltaX: number, deltaY: number) =>
      ({ deltaX, deltaY, preventDefault: vi.fn() }) as unknown as WheelEvent;
    const sideways = wheel(40, 5);
    page.wheel(sideways);
    expect(sideways.preventDefault).toHaveBeenCalled();
    expect(selected()).toBe('nvd');
    page.wheel(wheel(5, 0));
    page.wheel(wheel(20, 60));
    expect(selected()).toBe('nvd');
    page.wheel(wheel(-40, 0));
    expect(selected()).toBe('kev');
  });
});
