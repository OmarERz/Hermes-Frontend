import { Component, input } from '@angular/core';

/**
 * Judge detail of one evaluation (RE-3, RE-5, RE-6, FRO-13). Placeholder until the backend publishes
 * `GET /api/recommendations/{assessment_id}/judge` (F18.1): then this component loads it by `assessmentId` and shows
 * the accepted and rejected reasons with their points and quote (as data, escaped, SEG-02), the judge's summary and
 * status, and the blind double review. The news behind the evaluation, with their dates, are not in the contract
 * yet either. Nothing here is invented: it only says what is missing.
 */
@Component({
  selector: 'app-judge-detail',
  template: `
    <section class="judge-reason judge-pending" aria-label="Detalle del juez">
      <strong>Detalle del juez</strong>
      <p>
        Pendiente de la API: aquí se mostrarán los motivos aceptados y rechazados con su cita, el
        resumen del juez y la doble revisión. Mientras tanto, los motivos aceptados con sus puntos
        vienen en la justificación.
      </p>
      <strong>Noticias</strong>
      <p>
        Pendiente de la API: las noticias de esta evaluación, con su fecha, todavía no se exponen.
      </p>
    </section>
  `,
  styles: `
    .judge-pending {
      border-style: dashed;
    }
    .judge-pending strong + p + strong {
      display: block;
      margin-top: var(--space-2);
    }
  `,
  host: { '[attr.data-assessment-id]': 'assessmentId()' },
})
export class JudgeDetail {
  readonly assessmentId = input.required<string>();
}
