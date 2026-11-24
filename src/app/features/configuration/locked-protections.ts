import { Component, computed, inject, input } from '@angular/core';
import { LucideLock, LucideShieldCheck } from '@lucide/angular';
import { ROLE_LABELS } from '../../core/auth/roles';
import { SessionService } from '../../core/auth/session.service';
import { ConfigParameter, LOCKED_PROTECTIONS } from './config-model';

/**
 * "Permisos y políticas" reconverted (CO-3): the person's effective role (`GET /api/me`) and the protections no
 * route of the API can change (FRO-01), plus any parameter the schema marks `blocked`. All shown with 🔒 as text,
 * never as a control.
 */
@Component({
  selector: 'app-locked-protections',
  imports: [LucideLock, LucideShieldCheck],
  template: `
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
              ><strong>🔒 {{ item.name }}</strong> ({{ item.code }}): {{ item.effect }}</span
            >
          </li>
        }
        @for (param of blocked(); track param.key) {
          <li>
            <svg lucideLock aria-hidden="true"></svg>
            <span
              ><strong>🔒 {{ param.description }}</strong> ({{ param.key }}): bloqueado en el
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
  `,
  styles: `
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
