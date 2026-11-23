import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';
import {
  LucideBot,
  LucideCheck,
  LucideGitCompareArrows,
  LucideMessageSquareText,
  LucideScale,
  LucideUserRoundCheck,
  LucideX,
} from '@lucide/angular';
import {
  EstadoRevisionDemo,
  obtenerOpinionesJuez,
  proyectarPuntajesRevision,
  RevisionDemo,
  SupervisionAgentes,
} from '../../servicios/supervision-agentes';
import { OrigenDashboard } from '../../servicios/origen-dashboard';

type AccionHumana =
  'accept-recommendation' | 'assign-score' | 'accept-original-score' | 'reject-recommendation';

@Component({
  selector: 'app-revision-humana',
  imports: [
    FormsModule,
    LucideBot,
    LucideCheck,
    LucideGitCompareArrows,
    LucideMessageSquareText,
    LucideScale,
    LucideUserRoundCheck,
    LucideX,
  ],
  templateUrl: './revision-humana.html',
})
export class RevisionHumana implements OnInit, AfterViewInit {
  @Input({ required: true }) ticketId = '';
  @Input() recomendacionId = '';
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<string>();
  @ViewChild('dialogElement') private dialog?: ElementRef<HTMLDialogElement>;

  readonly origen = inject(OrigenDashboard);
  readonly supervision = inject(SupervisionAgentes);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly enNavegador = isPlatformBrowser(this.platformId);
  readonly acciones: { valor: AccionHumana; etiqueta: string }[] = [
    { valor: 'accept-recommendation', etiqueta: 'Aceptar recomendaci\u00f3n' },
    { valor: 'assign-score', etiqueta: 'Asignar puntaje' },
    { valor: 'accept-original-score', etiqueta: 'Aceptar puntaje original' },
    { valor: 'reject-recommendation', etiqueta: 'Rechazar recomendaci\u00f3n' },
  ];
  seleccionada: RevisionDemo | null = null;
  accion: AccionHumana | '' = '';
  puntajeNuevo: number | null = null;
  comentario = '';
  error = '';

  ngOnInit(): void {
    const objetivo =
      this.revisionesTicket.find((item) => item.id === this.recomendacionId) ??
      this.revisionesTicket[0];
    if (objetivo) this.abrir(objetivo);
  }

  ngAfterViewInit(): void {
    const dialogo = this.dialog?.nativeElement;
    if (!this.enNavegador || !dialogo || dialogo.open) return;
    if (typeof dialogo.showModal === 'function') dialogo.showModal();
    else dialogo.setAttribute('open', '');
  }

  get revisiones(): RevisionDemo[] {
    return this.origen.modo() === 'demo' ? this.supervision.revisiones() : [];
  }
  get revisionesTicket(): RevisionDemo[] {
    return this.revisiones.filter((item) => item.ticketId === this.ticketId);
  }
  get ticketsEnDesacuerdo(): boolean {
    return this.revisionesTicket.some((item) => item.decisionJuez === 'En desacuerdo');
  }
  get responsables(): string[] {
    return [...new Set(this.supervision.tickets.map((ticket) => ticket.responsable))];
  }
  get puntajesSeleccionados() {
    return this.seleccionada ? proyectarPuntajesRevision(this.seleccionada) : null;
  }
  /** Devuelve solo el puntaje original explícito de la evaluación activa; cero permanece válido. */
  get puntajeOriginalSeleccionado(): number | null {
    const puntaje = this.seleccionada?.evaluacion?.puntajeOriginal;
    return typeof puntaje === 'number' && Number.isFinite(puntaje) ? puntaje : null;
  }
  /** Comprueba presencia y finitud sin imponer una escala aún no confirmada. */
  get puntajeNuevoValido(): boolean {
    return this.puntajeNuevo !== null && Number.isFinite(this.puntajeNuevo);
  }
  get opinionesJuezSeleccionadas() {
    return this.seleccionada
      ? obtenerOpinionesJuez(this.seleccionada, this.origen.modo() === 'demo')
      : [];
  }
  get numeroJuezSeleccionado(): number {
    return this.seleccionada
      ? this.revisionesTicket.findIndex((item) => item.id === this.seleccionada?.id) + 1
      : 0;
  }

  /** Identifica el estado legible de la opinión asociada a la propuesta activa. */
  get opinionSeleccionada(): string {
    return (
      this.opinionesJuezSeleccionadas[0]?.opinion ??
      this.opinionesJuezSeleccionadas[0]?.estado ??
      'No disponible'
    );
  }

  /** Conserva el cero como puntaje válido y presenta aparte la ausencia de información. */
  mostrarPuntaje(valor: number | null | undefined): number | string {
    return valor === null || valor === undefined ? 'No disponible' : valor;
  }

  /** Obtiene el puntaje de la evaluación explícita sin sustituir ausencias ni valores cero. */
  puntajeDelJuez(revision: RevisionDemo): number | null {
    const opinion = revision.evaluacion?.opinionesJuez[0];
    return opinion ? opinion.puntaje : revision.puntajePropuesto;
  }
  get hayCambiosSinGuardar(): boolean {
    if (!this.seleccionada) return false;
    return !!this.accion || !!this.comentario.trim() || this.puntajeNuevo !== null;
  }

  abrir(revision: RevisionDemo): void {
    if (this.origen.modo() !== 'demo') return;
    if (
      this.seleccionada?.id !== revision.id &&
      this.hayCambiosSinGuardar &&
      this.enNavegador &&
      !window.confirm('Hay cambios sin guardar. ¿Descartarlos para cambiar de propuesta?')
    )
      return;
    this.seleccionada = revision;
    this.accion = '';
    this.puntajeNuevo = null;
    this.comentario = '';
    this.error = '';
  }

  cerrar(): void {
    if (
      this.hayCambiosSinGuardar &&
      this.enNavegador &&
      !window.confirm('Hay una decisión sin guardar. ¿Cerrar y descartar los cambios?')
    )
      return;
    this.dialog?.nativeElement.close();
  }

  cerrarConEscape(evento: Event): void {
    evento.preventDefault();
    this.cerrar();
  }

  notificarCierre(): void {
    this.closed.emit();
  }

  /** Valida y registra la decisión de la evaluación seleccionada solo en modo demostración. */
  confirmar(): void {
    const actual = this.seleccionada;
    if (!actual || this.origen.modo() !== 'demo' || !this.accion) {
      this.error = 'Selecciona una acción.';
      return;
    }
    if (
      this.accion === 'assign-score' &&
      (this.puntajeNuevo === null || !Number.isFinite(this.puntajeNuevo))
    ) {
      this.error = 'Escribe un nuevo puntaje numérico y finito.';
      return;
    }
    if (this.accion === 'accept-original-score' && this.puntajeOriginalSeleccionado === null) {
      this.error = 'El puntaje original no está disponible para esta evaluación.';
      return;
    }
    const puntajeHumano =
      this.accion === 'assign-score'
        ? { tipo: 'asignado' as const, valor: this.puntajeNuevo as number }
        : this.accion === 'accept-original-score'
          ? {
              tipo: 'puntaje-original-aceptado' as const,
              valor: this.puntajeOriginalSeleccionado as number,
            }
          : undefined;
    const decision =
      this.acciones.find((opcion) => opcion.valor === this.accion)?.etiqueta ?? this.accion;
    const resumenPuntaje = puntajeHumano ? ` Puntaje: ${puntajeHumano.valor}.` : '';
    if (
      this.enNavegador &&
      !window.confirm(
        `La decisión «${decision}» se guardará únicamente en los datos de demostración en memoria para ${actual.ticketId} · evaluación ${actual.id}.${resumenPuntaje} No se modificará un caso real. ¿Continuar?`,
      )
    )
      return;
    const estado: EstadoRevisionDemo =
      this.accion === 'accept-recommendation' || this.accion === 'reject-recommendation'
        ? 'Resuelto'
        : 'Revisado por humano';
    this.supervision.actualizarRevisionDemo(
      actual.id,
      estado,
      this.accion,
      this.comentario.trim(),
      puntajeHumano,
      decision,
    );
    this.saved.emit(
      `Decisión demostrativa registrada en memoria para ${actual.ticketId} · evaluación ${actual.id}; no se envió ni cambió el caso real.`,
    );
    this.dialog?.nativeElement.close('saved');
  }
}
