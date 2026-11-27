import { Component, computed, DestroyRef, inject, Injector, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight, LucideWandSparkles } from '@lucide/angular';
import { SessionService } from '../../core/auth/session.service';
import { SetupStep, stepState } from './setup-steps';
import { SetupService } from './setup.service';

/**
 * Notice for admins on the start screen while the first-run setup (docs/13 §9, D-042) has pending steps: it is how
 * the wizard shows up after the installation, with a stronger text while nothing is configured yet. Other roles never
 * see it and never call the API (`GET /api/setup/status` is admin only); a failed reading shows nothing.
 */
@Component({
  selector: 'app-setup-reminder',
  imports: [RouterLink, LucideArrowRight, LucideWandSparkles],
  template: `
    @if (pending(); as count) {
      <aside class="setup-reminder" aria-label="Configuración inicial">
        <span class="reminder-icon"><svg lucideWandSparkles aria-hidden="true"></svg></span>
        <p>
          <strong>{{
            fresh()
              ? 'Hermes todavía no está configurado.'
              : 'La configuración inicial no está completa.'
          }}</strong>
          {{ count }} de {{ total() }} pasos pendientes en el asistente.
        </p>
        <a routerLink="/asistente"
          >Abrir el asistente <svg lucideArrowRight aria-hidden="true"></svg
        ></a>
      </aside>
    }
  `,
  styles: `
    .setup-reminder {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px 14px;
      padding: 12px 16px;
      border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--border));
      border-radius: 14px;
      background: var(--accent-wash);
      color: var(--text-primary);
    }
    .reminder-icon {
      width: 34px;
      height: 34px;
      display: grid;
      flex: none;
      place-items: center;
      border-radius: 10px;
      background: var(--surface);
      color: var(--accent);
    }
    .reminder-icon svg {
      width: 20px;
      height: 20px;
    }
    p {
      flex: 1 1 260px;
      margin: 0;
      color: var(--text-secondary);
      font-size: calc(13px + var(--font-size-increase));
      line-height: 1.45;
    }
    strong {
      color: var(--text-primary);
    }
    a {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--accent-text);
      font-size: calc(13px + var(--font-size-increase));
      font-weight: 700;
      white-space: nowrap;
    }
    a svg {
      width: 16px;
      height: 16px;
    }
    a:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  `,
})
export class SetupReminder {
  readonly steps = signal<SetupStep[] | null>(null);

  readonly total = computed(() => this.steps()?.length ?? 0);
  /** Pending steps; null (nothing shown) when none is pending or the steps are unknown. */
  readonly pending = computed(
    () => this.steps()?.filter((step) => stepState(step) === 'pending').length || null,
  );
  /** Nothing is done or skipped yet: a fresh installation. */
  readonly fresh = computed(() => this.pending() === this.total());

  constructor() {
    const destroyRef = inject(DestroyRef);
    if (!inject(SessionService).hasRole('admin')) return;
    // Resolved only for admins, so other roles never build the API client.
    const subscription = inject(Injector)
      .get(SetupService)
      .status()
      .subscribe({ next: (steps) => this.steps.set(steps), error: () => undefined });
    destroyRef.onDestroy(() => subscription.unsubscribe());
  }
}
