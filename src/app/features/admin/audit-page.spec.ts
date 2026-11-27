import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { provideFakeSession } from '../../testing/fake-session';
import { dayBound } from '../runs/day-bound';
import { formatDateTime } from '../../shared/labels';
import { AuditPage } from './audit.page';
import { AuditEntry, AuditService } from './audit.service';

const BY_PERSON: AuditEntry = {
  id: 'e1',
  created_at: '2026-11-27T08:00:00Z',
  actor: 'ana@hermes.test',
  action: 'source.enable',
  target: 'source:cisa_kev',
};

const BY_SYSTEM: AuditEntry = {
  id: 'e2',
  created_at: '2026-11-27T07:00:00Z',
  actor: 'sistema',
  action: 'source.down',
  target: 'source:nvd',
};

const UNKNOWN: AuditEntry = {
  id: 'e3',
  created_at: '2026-11-26T07:00:00Z',
  actor: 'Luis',
  action: 'brand.new_action',
  target: 'thing:1',
};

class FakeAudit {
  list = vi.fn<AuditService['list']>(() =>
    of({ items: [BY_PERSON, BY_SYSTEM, UNKNOWN], nextCursor: 'n.s' }),
  );
}

async function render(audit = new FakeAudit()) {
  TestBed.configureTestingModule({
    imports: [AuditPage],
    providers: [
      { provide: AuditService, useValue: audit },
      ...provideFakeSession('admin'),
      provideRouter([]),
    ],
  });
  const fixture = TestBed.createComponent(AuditPage);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return { page: fixture.componentInstance, element, audit, settle };
}

/** The visible text, one space between the texts of separate elements (the template has no whitespace there). */
function text(element: Element | null | undefined): string {
  if (!element) return '';
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  while (walker.nextNode()) parts.push(walker.currentNode.textContent ?? '');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function rows(element: HTMLElement): string[][] {
  return Array.from(element.querySelectorAll('.audit-table tbody tr')).map((row) =>
    Array.from(row.querySelectorAll('td')).map((cell) => text(cell)),
  );
}

function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('change'));
}

describe('AuditPage', () => {
  it('shows who did what to which object and when, naming the known actions', async () => {
    const { element } = await render();
    expect(rows(element)).toEqual([
      [
        formatDateTime(BY_PERSON.created_at),
        'ana@hermes.test',
        'Activó una fuente source.enable',
        'source:cisa_kev',
      ],
      [
        formatDateTime(BY_SYSTEM.created_at),
        'Sistema',
        'Una fuente dejó de responder source.down',
        'source:nvd',
      ],
      [formatDateTime(UNKNOWN.created_at), 'Luis', 'brand.new_action', 'thing:1'],
    ]);
  });

  it('filters by actor and exact action from the first page, trimming the text', async () => {
    const { element, audit } = await render();
    const [actor, action] = Array.from(
      element.querySelectorAll('.filters input[type="search"]'),
    ) as HTMLInputElement[];
    type(actor, '  sistema ');
    expect(audit.list).toHaveBeenLastCalledWith(
      { actor: 'sistema', action: null, date_from: null, date_to: null },
      null,
      50,
    );
    type(action, 'source.enable');
    expect(audit.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ actor: 'sistema', action: 'source.enable' }),
      null,
      50,
    );
    const calls = audit.list.mock.calls.length;
    type(action, 'source.enable ');
    expect(audit.list.mock.calls.length).toBe(calls);
  });

  it('caps a text filter at the length the API accepts', async () => {
    const { page, audit } = await render();
    page.setActor('x'.repeat(150));
    expect(audit.list.mock.lastCall?.[0].actor).toHaveLength(100);
  });

  it('filters by dates and clears every filter', async () => {
    const { page, element, audit, settle } = await render();
    page.setDateFrom('2026-11-20');
    page.setDateTo('2026-11-21');
    expect(audit.list).toHaveBeenLastCalledWith(
      {
        actor: null,
        action: null,
        date_from: dayBound('2026-11-20', false),
        date_to: dayBound('2026-11-21', true),
      },
      null,
      50,
    );
    await settle();
    const clear = Array.from(element.querySelectorAll('button.more-filter')).find(
      (button) => text(button) === 'Quitar filtros',
    ) as HTMLButtonElement;
    clear.click();
    expect(audit.list).toHaveBeenLastCalledWith(
      { actor: null, action: null, date_from: null, date_to: null },
      null,
      50,
    );
  });

  it('suggests the known actions', async () => {
    const { element } = await render();
    const options = Array.from(element.querySelectorAll('#audit-actions option')).map((option) =>
      option.getAttribute('value'),
    );
    expect(options).toContain('config.update');
    expect(options).toContain('role_assigned');
  });

  it('says when nothing matches, and when there is nothing yet', async () => {
    const audit = new FakeAudit();
    audit.list.mockReturnValue(of({ items: [], nextCursor: null }));
    const { element, page, settle } = await render(audit);
    expect(text(element.querySelector('app-async-state'))).toBe(
      'Aún no hay registros de auditoría.',
    );
    page.setActor('nadie');
    await settle();
    expect(text(element.querySelector('app-async-state'))).toBe(
      'No hay registros con estos filtros.',
    );
  });

  it('shows the error with a retry and pages by cursor', async () => {
    const audit = new FakeAudit();
    audit.list.mockReturnValueOnce(
      throwError(
        () => new ApiError(403, 'forbidden', 'No tienes permiso para realizar esta acción.'),
      ),
    );
    const { element, settle } = await render(audit);
    expect(text(element.querySelector('[role="alert"]'))).toContain('No tienes permiso');
    (element.querySelector('app-async-state button') as HTMLButtonElement).click();
    await settle();
    expect(rows(element)).toHaveLength(3);
    (
      element.querySelector('[aria-label="Página siguiente de auditoría"]') as HTMLButtonElement
    ).click();
    await settle();
    expect(audit.list).toHaveBeenLastCalledWith(expect.anything(), 'n.s', 50);
    const refresh = Array.from(element.querySelectorAll('button.more-filter')).find(
      (button) => text(button) === 'Actualizar',
    ) as HTMLButtonElement;
    refresh.click();
    expect(audit.list).toHaveBeenLastCalledWith(expect.anything(), 'n.s', 50);
  });
});
