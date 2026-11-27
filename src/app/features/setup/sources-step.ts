import { Component, computed, DestroyRef, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, tap } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent } from '../../shared/async-state.component';
import { Source, TYPE_LABELS } from '../sources/source-labels';
import { SourcesService } from '../sources/sources.service';

/** A structural source that is on cannot be switched off (409 `structural_source`): it is listed with 🔒. */
export function isLocked(source: Source): boolean {
  return source.structural && source.active;
}

/**
 * Paso 4 · Fuentes (docs/13 §9, FRO-16): switches the optional sources on or off (`PATCH /api/sources/{id}`, the same
 * call as the Fuentes screen); the structural ones show with 🔒. Levels and own feeds stay in Fuentes.
 */
@Component({
  selector: 'app-setup-sources-step',
  imports: [AsyncStateComponent],
  template: `
    @if (notice(); as message) {
      <p class="step-message" role="status">{{ message }}</p>
    }
    @if (saveError(); as problem) {
      <p class="step-message error" role="alert">{{ problem }}</p>
    }
    @switch (load.status()) {
      @case ('error') {
        <app-async-state state="error" [error]="load.error()" (retry)="reload()" />
      }
      @case ('ready') {
        <p class="step-count">
          {{ activeOptional() }} de {{ optional().length }} fuentes opcionales activas
        </p>
        <ul class="step-list source-list">
          @for (source of optional(); track source.id) {
            <li [attr.data-id]="source.id">
              <span class="item-copy">
                <strong>{{ source.name }}</strong>
                <small>{{ typeLabel(source) }} · {{ source.level }}</small>
              </span>
              <label class="step-switch">
                <input
                  type="checkbox"
                  role="switch"
                  [checked]="source.active"
                  [disabled]="pending().has(source.id)"
                  [attr.aria-label]="(source.active ? 'Desactivar ' : 'Activar ') + source.name"
                  (change)="toggle(source, $event)"
                />
                <span>{{ source.active ? 'Activa' : 'Inactiva' }}</span>
              </label>
            </li>
          } @empty {
            <li class="item-empty">No hay fuentes opcionales.</li>
          }
        </ul>
        @if (locked().length) {
          <p class="step-locked">
            <strong>🔒 Siempre activas ({{ locked().length }}):</strong>
            {{ lockedNames() }}
          </p>
        }
      }
      @default {
        <app-async-state state="loading" loadingText="Cargando las fuentes…" />
      }
    }
  `,
  styleUrl: './setup-step.css',
})
export class SetupSourcesStep {
  private readonly service = inject(SourcesService);
  private readonly destroyRef = inject(DestroyRef);

  /** A source was switched (the wizard reads its steps again: step 4 is done after the first change). */
  readonly changed = output<void>();

  readonly load = new AsyncState<Source[]>();
  readonly sources = signal<Source[]>([]);
  readonly pending = signal<ReadonlySet<string>>(new Set());
  readonly notice = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);

  readonly optional = computed(() => this.sources().filter((source) => !isLocked(source)));
  readonly locked = computed(() => this.sources().filter(isLocked));
  readonly activeOptional = computed(
    () => this.optional().filter((source) => source.active).length,
  );
  readonly lockedNames = computed(() =>
    this.locked()
      .map((source) => source.name)
      .join(', '),
  );

  constructor() {
    this.reload();
    this.destroyRef.onDestroy(() => this.load.cancel());
  }

  reload(): void {
    this.load.run(this.service.listAll().pipe(tap((sources) => this.sources.set(sources))));
  }

  typeLabel(source: Source): string {
    return TYPE_LABELS[source.type] ?? source.type;
  }

  /**
   * Switches one source. The checkbox keeps showing the saved state until the API answers, so a refused change
   * (a missing role, a source that turned structural) never shows a state the source does not have.
   */
  toggle(source: Source, event: Event): void {
    (event.target as HTMLInputElement).checked = source.active;
    if (this.pending().has(source.id)) return;
    this.pending.update((ids) => new Set([...ids, source.id]));
    this.notice.set(null);
    this.saveError.set(null);
    this.service
      .update(source.id, { active: !source.active })
      .pipe(
        finalize(() =>
          this.pending.update((ids) => new Set([...ids].filter((id) => id !== source.id))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved) => {
          this.sources.update((all) => all.map((known) => (known.id === saved.id ? saved : known)));
          this.notice.set(
            saved.active ? `${saved.name} quedó activa.` : `${saved.name} quedó inactiva.`,
          );
          this.changed.emit();
        },
        error: (error: unknown) => this.saveError.set(toApiError(error).message),
      });
  }
}
