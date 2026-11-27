import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import type { Role } from '../../core/api/api-types';
import type { CursorPage } from '../../shared/cursor-pager';
import { provideFakeSession } from '../../testing/fake-session';
import type { PeerCompany } from './company-labels';
import { CompanyService } from './company.service';
import { PEER_PAGE_SIZE, peerProblems, PeersPanel } from './peers-panel';

const PAGOS: PeerCompany = {
  id: '5f1c2a3b-4d5e-4f60-8a9b-0c1d2e3f4a5b',
  name: 'Pagos Ejemplo',
  aliases: ['PagosEj', 'Pagos MX'],
  domain: 'pagos.example',
  sector: 'fintech',
  country: 'MX',
};
const RUTAS: PeerCompany = {
  id: '6a2d3b4c-5e6f-4a71-9b0c-1d2e3f4a5b6c',
  name: 'Rutas Ejemplo',
  aliases: [],
  domain: null,
  sector: 'transportation',
  country: 'CO',
};

class FakeCompany {
  listPeers = vi.fn<CompanyService['listPeers']>(() =>
    of({ items: [PAGOS, RUTAS], nextCursor: null }),
  );
  createPeer = vi.fn<CompanyService['createPeer']>((peer) =>
    of({ ...peer, id: '7b3e4c5d-6f70-4b82-8c1d-2e3f4a5b6c7d' }),
  );
  updatePeer = vi.fn<CompanyService['updatePeer']>((id, peer) => of({ ...peer, id }));
  deletePeer = vi.fn<CompanyService['deletePeer']>(() => of(undefined));
}

async function render(role: Role = 'admin', service = new FakeCompany()) {
  TestBed.configureTestingModule({
    imports: [PeersPanel],
    providers: [{ provide: CompanyService, useValue: service }, ...provideFakeSession(role)],
  });
  const fixture = TestBed.createComponent(PeersPanel);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const stable = () => fixture.whenStable();
  const click = async (selector: string) => {
    element.querySelector<HTMLButtonElement>(selector)!.click();
    await stable();
  };
  const type = async (name: string, value: string) => {
    const field = element.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!;
    field.value = value;
    field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input'));
    await stable();
  };
  return { fixture, element, service, panel: fixture.componentInstance, click, type, stable };
}

const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
/** The text of each cell, with its parts (name, domain) separated by a space. */
const cell = (td: Element) =>
  td.children.length ? Array.from(td.children).map(text).join(' ') : text(td);
const rows = (element: HTMLElement) =>
  Array.from(element.querySelectorAll('tbody tr')).map((row) =>
    Array.from(row.querySelectorAll('td')).map(cell),
  );

describe('PeersPanel', () => {
  it('lists the peers in Spanish and hides every action from non-admins', async () => {
    const { element, service } = await render('analyst');
    expect(service.listPeers).toHaveBeenCalledWith(null, PEER_PAGE_SIZE);
    expect(rows(element)).toEqual([
      ['Pagos Ejemplo pagos.example', 'PagosEj, Pagos MX', 'Tecnología financiera', 'México (MX)'],
      ['Rutas Ejemplo', '—', 'Transporte', 'Colombia (CO)'],
    ]);
    expect(element.querySelector('.panel-action')).toBeNull();
    expect(element.querySelector('.row-action')).toBeNull();
    expect(element.querySelector('.peers-pages')).toBeNull();
  });

  it('adds a peer with its aliases and starts the list over', async () => {
    const { element, service, click, type } = await render();
    await click('.panel-action');
    expect(text(element.querySelector('#peer-form-title'))).toBe('Nueva empresa par');
    await type('peer-name', '  Movilidad Ejemplo ');
    await type('peer-domain', 'movilidad.example');
    await type('peer-sector', 'transportation');
    await type('peer-country', 'co');
    await type('peer-alias', 'MovEj');
    await click('.inline-add .secondary-button');
    await type('peer-alias', 'Movilidad   MX');
    element
      .querySelector<HTMLInputElement>('[name="peer-alias"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await click('.peer-form button[type="submit"]');

    expect(service.createPeer).toHaveBeenCalledWith({
      name: 'Movilidad Ejemplo',
      aliases: ['MovEj', 'Movilidad MX'],
      domain: 'movilidad.example',
      sector: 'transportation',
      country: 'CO',
    });
    expect(element.querySelector('form')).toBeNull();
    expect(text(element.querySelector('[role="status"]'))).toBe('Movilidad Ejemplo se agregó.');
    expect(service.listPeers).toHaveBeenCalledTimes(2);
  });

  it('checks the form before sending it', async () => {
    const { element, service, click, type } = await render();
    await click('.panel-action');
    await type('peer-domain', 'https://pagos.example/inicio');
    await click('.peer-form button[type="submit"]');
    expect(service.createPeer).not.toHaveBeenCalled();
    expect(text(element.querySelector('#peer-name-error'))).toBe(
      'Escribe el nombre de la empresa.',
    );
    expect(text(element.querySelector('#peer-domain-error'))).toContain('sin https://');
    expect(text(element.querySelector('#peer-sector-error'))).toBe(
      'Elige el sector de la empresa.',
    );
    expect(text(element.querySelector('#peer-country-error'))).toContain('dos letras');
    expect(element.querySelector('[name="peer-name"]')?.getAttribute('aria-invalid')).toBe('true');

    await click('.peer-form footer .secondary-button');
    expect(element.querySelector('form')).toBeNull();
  });

  it('refuses repeated, empty and too long aliases, and removes one', async () => {
    const { element, panel, click, type, stable } = await render();
    await click('.row-action[aria-label="Editar Pagos Ejemplo"]');
    expect(panel.aliases()).toEqual(['PagosEj', 'Pagos MX']);
    await type('peer-alias', '   ');
    await click('.inline-add .secondary-button');
    expect(panel.aliases()).toHaveLength(2);
    await type('peer-alias', 'pagosej');
    await click('.inline-add .secondary-button');
    expect(text(element.querySelector('#peer-alias-error'))).toBe('«pagosej» ya está en la lista.');
    await type('peer-alias', 'x'.repeat(201));
    await click('.inline-add .secondary-button');
    expect(text(element.querySelector('#peer-alias-error'))).toContain('hasta 200 caracteres');
    panel.aliases.set(Array.from({ length: 50 }, (_, index) => `Alias ${index}`));
    await type('peer-alias', 'Uno más');
    await click('.inline-add .secondary-button');
    expect(text(element.querySelector('#peer-alias-error'))).toContain('hasta 50 alias');

    panel.aliases.set(['PagosEj', 'Pagos MX']);
    await stable();
    await click('.chip button[aria-label="Quitar alias PagosEj"]');
    expect(panel.aliases()).toEqual(['Pagos MX']);
  });

  it('edits a peer, keeps an unlisted sector and reloads the same page', async () => {
    const service = new FakeCompany();
    const custom = { ...RUTAS, sector: 'logistics' };
    service.listPeers.mockReturnValue(of({ items: [PAGOS, custom], nextCursor: null }));
    const { element, click, type } = await render('admin', service);
    await click('.row-action[aria-label="Editar Rutas Ejemplo"]');
    expect(text(element.querySelector('#peer-form-title'))).toBe('Editar empresa par');
    const sectors = Array.from(element.querySelectorAll('[name="peer-sector"] option')).map(text);
    expect(sectors).toContain('logistics');
    await type('peer-name', 'Rutas Ejemplo SA');
    await click('.peer-form button[type="submit"]');
    expect(service.updatePeer).toHaveBeenCalledWith(RUTAS.id, {
      name: 'Rutas Ejemplo SA',
      aliases: [],
      domain: null,
      sector: 'logistics',
      country: 'CO',
    });
    expect(text(element.querySelector('[role="status"]'))).toBe('Rutas Ejemplo SA se guardó.');
    expect(service.listPeers).toHaveBeenLastCalledWith(null, PEER_PAGE_SIZE);
  });

  it('shows the API refusal and marks the field it names', async () => {
    const service = new FakeCompany();
    service.createPeer.mockReturnValueOnce(
      throwError(
        () =>
          new ApiError(409, 'conflict', 'Un alias ya pertenece a otra empresa par.', [
            { field: 'body.aliases', issue: 'duplicate_alias' },
          ]),
      ),
    );
    const { element, panel, click, type } = await render('admin', service);
    await click('.panel-action');
    await type('peer-name', 'Otra');
    await type('peer-sector', 'fintech');
    await type('peer-country', 'MX');
    panel.aliases.set(['PagosEj']);
    await click('.peer-form button[type="submit"]');
    expect(text(element.querySelector('.peer-form [role="alert"]'))).toBe(
      'Un alias ya pertenece a otra empresa par.',
    );
    expect(element.querySelector('[name="peer-alias"]')?.getAttribute('aria-invalid')).toBe('true');
    expect(element.querySelector('[name="peer-name"]')?.getAttribute('aria-invalid')).toBe('false');
    expect(element.querySelector('form')).not.toBeNull();
  });

  it('asks before removing a peer and can step back', async () => {
    const { element, service, click } = await render();
    await click('.row-action[aria-label="Quitar Rutas Ejemplo"]');
    expect(text(element.querySelector('.remove-question'))).toBe('¿Quitar Rutas Ejemplo?');
    await click('.cancel-remove');
    expect(element.querySelector('.remove-question')).toBeNull();
    expect(service.deletePeer).not.toHaveBeenCalled();

    await click('.row-action[aria-label="Quitar Rutas Ejemplo"]');
    await click('.confirm-remove');
    expect(service.deletePeer).toHaveBeenCalledWith(RUTAS.id);
    expect(text(element.querySelector('[role="status"]'))).toBe(
      'Rutas Ejemplo se quitó de las empresas pares.',
    );
    expect(service.listPeers).toHaveBeenCalledTimes(2);
  });

  it('keeps the confirmation with the API message when the removal fails', async () => {
    const service = new FakeCompany();
    service.deletePeer.mockReturnValueOnce(
      throwError(() => new ApiError(404, 'not_found', 'La empresa par no existe.')),
    );
    const { element, click } = await render('admin', service);
    await click('.row-action[aria-label="Quitar Pagos Ejemplo"]');
    await click('.confirm-remove');
    expect(text(element.querySelector('.row-actions [role="alert"]'))).toBe(
      'La empresa par no existe.',
    );
    expect(element.querySelector('.remove-question')).not.toBeNull();
  });

  it('pages with the opaque cursor and steps back when the last peer of a page goes', async () => {
    const service = new FakeCompany();
    const pages: Record<string, CursorPage<PeerCompany>> = {
      first: { items: [PAGOS], nextCursor: 'c2.sig' },
      second: { items: [RUTAS], nextCursor: null },
    };
    service.listPeers.mockImplementation((cursor) =>
      of(cursor === 'c2.sig' ? pages['second'] : pages['first']),
    );
    const { element, click } = await render('admin', service);
    expect(text(element.querySelector('.peers-pages'))).toContain('Página 1');
    await click('[aria-label="Página siguiente"]');
    expect(service.listPeers).toHaveBeenLastCalledWith('c2.sig', PEER_PAGE_SIZE);
    expect(rows(element)[0][0]).toBe('Rutas Ejemplo');

    await click('.row-action[aria-label="Quitar Rutas Ejemplo"]');
    await click('.confirm-remove');
    expect(service.listPeers).toHaveBeenLastCalledWith(null, PEER_PAGE_SIZE);
    expect(text(element.querySelector('.peers-pages'))).toContain('Página 1');

    await click('[aria-label="Página siguiente"]');
    await click('[aria-label="Página anterior"]');
    expect(rows(element)[0][0]).toBe('Pagos Ejemplo pagos.example');
  });

  it('shows the loading, empty and error states', async () => {
    const service = new FakeCompany();
    const pending = new Subject<CursorPage<PeerCompany>>();
    service.listPeers.mockReturnValueOnce(pending as Observable<CursorPage<PeerCompany>>);
    const { element, stable } = await render('reader', service);
    expect(text(element.querySelector('[role="status"]'))).toBe('Cargando las empresas pares…');
    pending.error(new ApiError(500, 'internal_error', 'Ocurrió un error en el servidor.'));
    await stable();
    expect(text(element.querySelector('[role="alert"]'))).toContain('Ocurrió un error');

    service.listPeers.mockReturnValueOnce(of({ items: [], nextCursor: null }));
    element.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await stable();
    expect(text(element.querySelector('.state'))).toBe(
      'Todavía no hay empresas pares: R3 solo usa el sector del perfil.',
    );
  });
});

describe('peerProblems', () => {
  const valid = { name: 'Pagos', aliases: [], domain: null, sector: 'fintech', country: 'MX' };

  it('accepts a complete peer', () => {
    expect(peerProblems(valid)).toEqual({});
  });

  it('names each field that breaks a rule', () => {
    expect(
      peerProblems({ ...valid, name: 'x'.repeat(201), domain: 'd'.repeat(254), country: 'mx' }),
    ).toEqual({
      name: 'El nombre admite hasta 200 caracteres.',
      domain: 'El dominio admite hasta 253 caracteres.',
      country: 'Escribe el código ISO de dos letras del país (por ejemplo, MX).',
    });
    expect(peerProblems({ ...valid, domain: 'pagos example' }).domain).toContain('solo el dominio');
  });
});
