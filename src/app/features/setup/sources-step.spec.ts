import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { makeSource } from '../sources/source-fixtures';
import type { Source } from '../sources/source-labels';
import { SourcesService } from '../sources/sources.service';
import { isLocked, SetupSourcesStep } from './sources-step';

const KEV = makeSource();
const NVD = makeSource({ id: 'nvd', name: 'NVD' });
const BLOG = makeSource({
  id: 'blog',
  name: 'Blog de investigación',
  type: 'research',
  level: 'N2',
  structural: false,
  active: false,
});
const MEDIA = makeSource({
  id: 'media',
  name: 'Medio especializado',
  type: 'media',
  level: 'N3',
  structural: false,
  active: true,
});

class FakeSources {
  listAll = vi.fn<SourcesService['listAll']>(() => of([KEV, NVD, BLOG, MEDIA]));
  update = vi.fn<SourcesService['update']>((id, change) =>
    of({ ...[BLOG, MEDIA].find((source) => source.id === id)!, ...change } as Source),
  );
}

async function render(service = new FakeSources()) {
  TestBed.configureTestingModule({
    imports: [SetupSourcesStep],
    providers: [{ provide: SourcesService, useValue: service }],
  });
  const fixture = TestBed.createComponent(SetupSourcesStep);
  const changed = vi.fn();
  fixture.componentInstance.changed.subscribe(changed);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const toggle = (id: string) =>
    element.querySelector(`li[data-id="${id}"] input[role="switch"]`) as HTMLInputElement;
  return { fixture, element, service, changed, toggle };
}

const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('SetupSourcesStep', () => {
  it('lists the optional sources with a switch and the structural ones with 🔒', async () => {
    const { element, toggle } = await render();
    expect(Array.from(element.querySelectorAll('li[data-id] .item-copy strong')).map(text)).toEqual(
      ['Blog de investigación', 'Medio especializado'],
    );
    expect(text(element.querySelector('li[data-id="blog"] small'))).toBe('Investigación · N2');
    expect(text(element.querySelector('.step-count'))).toBe('1 de 2 fuentes opcionales activas');
    expect(toggle('blog').checked).toBe(false);
    expect(toggle('blog').getAttribute('aria-label')).toBe('Activar Blog de investigación');
    expect(toggle('media').getAttribute('aria-label')).toBe('Desactivar Medio especializado');
    expect(text(element.querySelector('.step-locked'))).toBe(
      '🔒 Siempre activas (2): CISA KEV, NVD',
    );
  });

  it('switches a source, showing the saved state only once the API answers', async () => {
    const service = new FakeSources();
    const answer = new Subject<Source>();
    service.update.mockReturnValueOnce(answer);
    const { fixture, element, changed, toggle } = await render(service);
    toggle('blog').click();
    await fixture.whenStable();
    expect(service.update).toHaveBeenCalledWith('blog', { active: true });
    expect(toggle('blog').checked).toBe(false);
    expect(toggle('blog').disabled).toBe(true);
    // A second change of the same source waits for the first.
    fixture.componentInstance.toggle(BLOG, { target: toggle('blog') } as unknown as Event);
    expect(service.update).toHaveBeenCalledTimes(1);

    answer.next({ ...BLOG, active: true });
    answer.complete();
    await fixture.whenStable();
    expect(toggle('blog').checked).toBe(true);
    expect(toggle('blog').disabled).toBe(false);
    expect(text(element.querySelector('[role="status"]'))).toBe(
      'Blog de investigación quedó activa.',
    );
    expect(text(element.querySelector('.step-count'))).toBe('2 de 2 fuentes opcionales activas');
    expect(changed).toHaveBeenCalledTimes(1);

    toggle('media').click();
    await fixture.whenStable();
    expect(text(element.querySelector('[role="status"]'))).toBe(
      'Medio especializado quedó inactiva.',
    );
  });

  it('keeps the source as it was and shows the API message when the change is refused', async () => {
    const service = new FakeSources();
    service.update.mockReturnValueOnce(
      throwError(() => new ApiError(409, 'structural_source', 'Esta fuente no se puede apagar.')),
    );
    const { fixture, element, changed, toggle } = await render(service);
    toggle('media').click();
    await fixture.whenStable();
    expect(toggle('media').checked).toBe(true);
    expect(text(element.querySelector('[role="alert"]'))).toBe('Esta fuente no se puede apagar.');
    expect(changed).not.toHaveBeenCalled();
  });

  it('retries a failed load and says when there is no optional source', async () => {
    const service = new FakeSources();
    service.listAll.mockReturnValueOnce(
      throwError(() => new ApiError(500, 'internal_error', 'Error interno del servidor.')),
    );
    service.listAll.mockReturnValueOnce(of([KEV]));
    const { fixture, element } = await render(service);
    expect(text(element.querySelector('[role="alert"]'))).toContain('Error interno del servidor.');
    (element.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(text(element.querySelector('.item-empty'))).toBe('No hay fuentes opcionales.');
  });

  it('locks only a structural source that is on (an inactive one can be switched on)', () => {
    expect(isLocked(KEV)).toBe(true);
    expect(isLocked({ ...KEV, active: false })).toBe(false);
    expect(isLocked(BLOG)).toBe(false);
  });
});
