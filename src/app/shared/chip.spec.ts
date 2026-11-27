import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Chip, ChipTone } from './chip';
import { criticalityLabel, criticalityTone, STATUS_TONES } from './labels';

@Component({
  imports: [Chip],
  template: `<app-chip [tone]="tone()">Crítica</app-chip><app-chip>Sin tono</app-chip>`,
})
class Host {
  readonly tone = signal<ChipTone>('critical');
}

describe('Chip', () => {
  it('is the chip itself, with its tone as data and the projected text', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const [chip, plain] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('app-chip'),
    );
    expect(chip.classList).toContain('ui-chip');
    expect(chip.getAttribute('data-tone')).toBe('critical');
    expect(chip.textContent).toBe('Crítica');
    expect(plain.getAttribute('data-tone')).toBe('neutral');

    fixture.componentInstance.tone.set('success');
    await fixture.whenStable();
    expect(chip.getAttribute('data-tone')).toBe('success');
  });
});

describe('chip labels', () => {
  it('translates the criticality of iTop and keeps an unknown value as it comes', () => {
    expect(criticalityLabel('high')).toBe('Alta');
    expect(criticalityLabel('medium')).toBe('Media');
    expect(criticalityLabel('low')).toBe('Baja');
    expect(criticalityLabel('unknown')).toBe('Sin dato');
    expect(criticalityLabel('')).toBe('Sin dato');
    expect(criticalityLabel(null)).toBe('Sin dato');
    expect(criticalityLabel('Muy alta')).toBe('Muy alta');
  });

  it('gives each criticality and finding status its chip tone', () => {
    expect(['high', 'medium', 'low', 'unknown', null].map(criticalityTone)).toEqual([
      'high',
      'medium',
      'low',
      'neutral',
      'neutral',
    ]);
    expect(STATUS_TONES).toEqual({
      new: 'violet',
      persistent: 'warning',
      reopened: 'danger',
      fixed: 'success',
      no_data: 'neutral',
    });
  });
});
