import { booleanAttribute, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideLock, LucideShieldCheck } from '@lucide/angular';
import { ROLE_LABELS } from '../../core/auth/roles';
import { SessionService } from '../../core/auth/session.service';
import { ConfigParameter, LOCKED_PROTECTIONS } from './config-model';

/**
 * "Permisos y políticas" reconverted (CO-3): the person's effective role (`GET /api/me`) and the protections no
 * route of the API can change (FRO-01), plus any parameter the schema marks `blocked`. All shown as text with a lock
 * icon, never as a control. `summary` (Fórmula and Parámetros, FOR-4) shrinks it to one line with the role, the
 * count and a link to the full list on the judge screen, so the list is not repeated at the end of every screen.
 */
@Component({
  selector: 'app-locked-protections',
  imports: [LucideLock, LucideShieldCheck, RouterLink],
  template: `
    @if (summary()) {
      <p class="locked-summary notice">
        <svg lucideShieldCheck aria-hidden="true"></svg>
        <span
          >Tu rol: <strong>{{ roleLabel() }}</strong
          >. {{ protections.length }} protecciones bloqueadas
          @if (blocked().length) {
            y {{ blocked().length }}
            {{ blocked().length === 1 ? 'parámetro bloqueado' : 'parámetros bloqueados' }} en el
            servidor
          }
          que nadie puede cambiar desde el front.
          <a routerLink="/configuracion-agente">Ver permisos y protecciones</a></span
        >
      </p>
    } @else {
      <section class="config-card permissions-card" aria-labelledby="locked-title">
        <header>
          <h2 id="locked-title">
            <svg lucideShieldCheck aria-hidden="true"></svg> Permisos y protecciones
          </h2>
          <p>
            Tu rol: <strong>{{ roleLabel() }}</strong
            >. {{ roleNote() }}
          </p>
        </header>
        <ul class="permission-list locked-list">
          @for (item of protections; track item.code) {
            <li>
              <svg lucideLock aria-hidden="true"></svg>
              <span
                ><strong>{{ item.name }}</strong> ({{ item.code }}): {{ item.effect }}</span
              >
            </li>
          }
          @for (param of blocked(); track param.key) {
            <li>
              <svg lucideLock aria-hidden="true"></svg>
              <span
                ><strong>{{ param.description }}</strong> ({{ param.key }}): bloqueado en el
                servidor.</span
              >
            </li>
          }
        </ul>
        <p class="small-note">
          Nadie puede cambiarlas desde el front ni la calibración: no existe ruta de la API que las
          modifique. El piso KEV + expuesto (80–100) y el umbral de doble revisión (10–20) solo se
          editan dentro de su rango.
        </p>
      </section>
    }
  `,
  styles: `
    .locked-summary {
      display: flex;
      align-items: flex-start;
      gap: var(--space-2);
      margin: 0;
      padding: var(--notice-pad-y) var(--notice-pad-x);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--surface);
      color: var(--text-secondary);
      font-size: var(--text-sm);
      line-height: var(--leading-normal);
    }
    .locked-summary svg {
      width: 18px;
      height: 18px;
      flex: none;
      margin-top: var(--space-0-5);
      color: var(--success-text);
    }
    .locked-summary strong {
      color: var(--text-primary);
    }
    .locked-summary a {
      color: var(--accent-text);
      font-weight: var(--weight-semibold);
    }
    .locked-list li {
      align-items: flex-start;
    }
    .locked-list svg {
      flex: none;
      margin-top: 3px;
      color: var(--warning-text) !important;
    }
  `,
})
export class LockedProtections {
  private readonly session = inject(SessionService);

  /** Parameters of the screen that the schema marks `blocked`. */
  readonly parameters = input<readonly ConfigParameter[]>([]);
  /** One line with a link to the full list (the judge screen), instead of the whole list. */
  readonly summary = input(false, { transform: booleanAttribute });

  readonly protections = LOCKED_PROTECTIONS;
  readonly blocked = computed(() => this.parameters().filter((p) => p.level === 'blocked'));
  readonly roleLabel = computed(() => {
    const role = this.session.role();
    return role ? ROLE_LABELS[role] : 'Sin sesión';
  });
  readonly roleNote = computed(() => {
    if (this.session.hasRole('admin')) {
      return 'Puedes cambiar los parámetros editables, siempre con confirmación.';
    }
    return this.session.hasRole('analyst')
      ? 'Puedes cambiar solo los parámetros que permiten el rol de analista; el resto lo cambia un administrador.'
      : 'Puedes ver la configuración; los cambios los hace un administrador (o un analista, según el parámetro).';
  });
}
