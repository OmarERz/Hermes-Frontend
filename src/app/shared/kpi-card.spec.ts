import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LucideLayers } from '@lucide/angular';
import { KpiCard, KpiState, kpiState, KpiTone } from './kpi-card';

@Component({
  imports: [KpiCard],
  template: `<app-kpi-card
    label="Activas"
    [value]="value()"
    [state]="state()"
    [icon]="icon()"
    [tone]="tone()"
    [kind]="kind()"
    [note]="note()"
    [help]="help()"
    [nested]="nested()"
    ><em class="kpi-detail">p95 5 s</em></app-kpi-card
  >`,
})
class Host {
  readonly value = signal<string | number | null>(12);
  readonly state = signal<KpiState>('ready');
  readonly icon = signal<typeof LucideLayers | null>(null);
  readonly tone = signal<KpiTone>('accent');
  readonly kind = signal<'number' | 'text'>('number');
  readonly note = signal<string | null>(null);
  readonly help = signal<string | null>(null);
  readonly nested = signal(false);
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const card = element.querySelector('app-kpi-card') as HTMLElement;
  const settle = () => fixture.whenStable();
  return { host: fixture.componentInstance, card, settle };
}

const text = (node: Element | null | undefined) =>
  (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('KpiCard', () => {
  it('shows the label, the value and what is projected next to it', async () => {
    const { card } = await render();
    expect(card.classList).toContain('kpi-card');
    expect(text(card.querySelector('.kpi-label'))).toBe('Activas');
    expect(text(card.querySelector('.kpi-value'))).toBe('12');
    expect(text(card.querySelector('.kpi-value-row .kpi-detail'))).toBe('p95 5 s');
    expect(card.querySelector('.kpi-icon')).toBeNull();
    expect(card.querySelector('.kpi-note')).toBeNull();
    expect(card.querySelector('app-ayuda-tooltip')).toBeNull();
    expect(card.getAttribute('aria-busy')).toBeNull();
  });

  it('reads a missing value as a dash, in the muted style', async () => {
    const { host, card, settle } = await render();
    for (const missing of [null, '']) {
      host.value.set(missing);
      await settle();
      expect(text(card.querySelector('.kpi-value'))).toBe('—');
      expect(card.querySelector('.kpi-value')?.classList).toContain('kpi-pending');
    }
    host.value.set(0);
    await settle();
    expect(text(card.querySelector('.kpi-value'))).toBe('0');
    expect(card.querySelector('.kpi-value')?.classList).not.toContain('kpi-pending');
  });

  it('shows a placeholder while loading, named for screen readers, and «Sin datos» on an error', async () => {
    const { host, card, settle } = await render();
    host.state.set('loading');
    await settle();
    expect(card.getAttribute('aria-busy')).toBe('true');
    expect(card.querySelector('.kpi-placeholder')?.getAttribute('aria-hidden')).toBe('true');
    expect(text(card.querySelector('.kpi-value'))).toBe('Cargando…');

    host.state.set('error');
    await settle();
    expect(card.getAttribute('aria-busy')).toBeNull();
    expect(card.querySelector('.kpi-placeholder')).toBeNull();
    expect(text(card.querySelector('.kpi-value'))).toBe('Sin datos');
  });

  it('draws the icon tile with its tone, the note, the help button and the variants', async () => {
    const { host, card, settle } = await render();
    host.icon.set(LucideLayers);
    host.tone.set('critical');
    host.note.set('Últimas 24 h');
    host.help.set('Fuentes que Hermes lee.');
    host.kind.set('text');
    host.nested.set(true);
    await settle();
    expect(card.classList).toContain('kpi-has-icon');
    expect(card.classList).toContain('kpi-nested');
    expect(card.querySelector('.kpi-icon')?.getAttribute('data-tone')).toBe('critical');
    expect(card.querySelector('.kpi-icon svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(text(card.querySelector('.kpi-note'))).toBe('Últimas 24 h');
    expect(
      card.querySelector('.kpi-label app-ayuda-tooltip button')?.getAttribute('aria-label'),
    ).toBe('Ayuda: Fuentes que Hermes lee.');
    expect(card.querySelector('.kpi-value')?.classList).toContain('kpi-text');
  });
});

describe('kpiState', () => {
  it('maps a load status to the state of a card', () => {
    expect(kpiState('ready')).toBe('ready');
    expect(kpiState('error')).toBe('error');
    expect(kpiState('loading')).toBe('loading');
    expect(kpiState('idle')).toBe('loading');
  });
});
