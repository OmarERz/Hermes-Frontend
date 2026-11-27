import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { AddSourceForm, nameProblem, urlProblem } from './add-source-form';
import { makeSource } from './source-fixtures';
import type { Source } from './source-labels';
import { SourcesService } from './sources.service';

class FakeSources {
  create = vi.fn<SourcesService['create']>(() =>
    of(
      makeSource({
        id: 'new',
        name: 'Boletín',
        type: 'feed',
        level: 'N4',
        structural: false,
        active: false,
      }),
    ),
  );
}

async function render(service = new FakeSources()) {
  TestBed.configureTestingModule({
    imports: [AddSourceForm],
    providers: [{ provide: SourcesService, useValue: service }],
  });
  const fixture = TestBed.createComponent(AddSourceForm);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const type = async (name: string, value: string) => {
    const input = element.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
    await fixture.whenStable();
  };
  const submit = async () => {
    element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
  };
  return { fixture, element, service, type, submit };
}

describe('AddSourceForm', () => {
  it('checks the name and the HTTPS address before calling the API', async () => {
    expect(nameProblem('  ')).toBe('Escribe un nombre para la fuente.');
    expect(nameProblem('a'.repeat(201))).toContain('200');
    expect(urlProblem('http://feeds.example.test/a.xml')).toBe(
      'La dirección debe empezar con https://.',
    );
    expect(urlProblem('https://')).toBe('La dirección no es válida.');
    expect(urlProblem(`https://example.test/${'a'.repeat(2048)}`)).toContain('2048');
    expect(urlProblem(' https://feeds.example.test/a.xml ')).toBeNull();

    const { element, service, submit } = await render();
    await submit();
    expect(service.create).not.toHaveBeenCalled();
    expect(element.querySelector('#add-source-name-error')?.textContent).toContain(
      'Escribe un nombre',
    );
    expect(element.querySelector('[name="url"]')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('sends the trimmed feed and hands the created source over', async () => {
    const { fixture, service, type, submit } = await render();
    const created: Source[] = [];
    fixture.componentInstance.created.subscribe((source) => created.push(source));
    await type('name', '  Boletín  ');
    await type('url', ' https://feeds.example.test/a.xml ');
    await type('kind', '1: atom');
    await submit();
    expect(service.create).toHaveBeenCalledWith({
      name: 'Boletín',
      url: 'https://feeds.example.test/a.xml',
      kind: 'atom',
    });
    expect(created.map((source) => source.level)).toEqual(['N4']);
  });

  it('shows the API refusal and marks the field it names', async () => {
    const service = new FakeSources();
    service.create.mockReturnValueOnce(
      throwError(
        () =>
          new ApiError(422, 'validation_error', 'URL no permitida: el host es privado.', [
            { field: 'body.url', issue: 'source_rule' },
          ]),
      ),
    );
    const { element, type, submit } = await render(service);
    await type('name', 'Interno');
    await type('url', 'https://intranet.example.test/feed');
    await submit();
    expect(element.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'URL no permitida: el host es privado.',
    );
    expect(element.querySelector('[name="url"]')?.getAttribute('aria-invalid')).toBe('true');
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
  });

  it('cancels without calling the API', async () => {
    const { fixture, element, service } = await render();
    let cancelled = 0;
    fixture.componentInstance.cancelled.subscribe(() => cancelled++);
    element.querySelector<HTMLButtonElement>('.secondary-button')!.click();
    expect(cancelled).toBe(1);
    expect(service.create).not.toHaveBeenCalled();
  });
});
