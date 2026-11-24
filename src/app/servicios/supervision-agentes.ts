import { Injectable, signal } from '@angular/core';

export type EstadoTicketDemo =
  'Pendiente' | 'En ejecución' | 'Completado' | 'Rechazado' | 'Revisión humana' | 'Reasignado';
export type EstadoRevisionDemo =
  | 'Pendiente de revisión'
  | 'Marcado para revisión'
  | 'En revisión humana'
  | 'Revisado por humano'
  | 'Resuelto';
export type PerfilConservador = 'Bajo' | 'Medio' | 'Alto' | 'Personalizado';

/** Provisional presentation values; they are not real agent controls. */
export interface ParametrosPersonalizadosDemo {
  autonomia: number;
  revision: number;
  cautela: number;
}

export interface TicketDemo {
  id: string;
  agente: string;
  estado: EstadoTicketDemo;
  creado: string;
  responsable: string;
  escalado: boolean;
  reasignado: boolean;
  minutosResolucion?: number;
}

export interface PropuestaDemo {
  id: string;
  ticketId: string;
  agente: string;
  estadoAnterior: string;
  estadoPropuesto: string;
  analisis: string;
  justificacion: string;
  puntajeAnterior: number;
  puntajePropuesto: number;
  decisionJuez: string;
  motivoDecision: string;
}

/** Modelo interno de presentación para las etapas de puntaje; no define el JSON del backend. */
export interface PuntajesRevisionInternos {
  puntajeOriginal: number | null;
  puntajeDeterminista: number | null;
  escala: string | null;
  opinionesJuez: OpinionJuezInterna[];
  analisisOriginal?: string | null;
  resultadoDeterminista?: string | null;
  analisisDeterminista?: string | null;
  justificacionDeterminista?: string | null;
}

/** Una opinión de juez aislada para evitar mezclar sus resultados o justificaciones. */
export interface OpinionJuezInterna {
  id: string;
  puntaje: number | null;
  escala?: string | null;
  opinion: string | null;
  justificacion: string | null;
  analisis?: string | null;
  estado: string | null;
}

export interface EjecucionDemo {
  id: string;
  fecha: string;
  agente: string;
  ticketId: string;
  accion: string;
  estadoInicial: string;
  estadoFinal: string;
  resultado: string;
  duracionSegundos: number;
  herramientas: string[];
  recomendacionId: string;
  decisionJuez: string;
  intervencionHumana: string;
  error: string;
  tipo: string;
  actor?: string;
}

export interface RevisionDemo extends PropuestaDemo {
  cveId?: string | null;
  evaluacion?: PuntajesRevisionInternos;
  estadoRevision: EstadoRevisionDemo;
  motivoRevision: string;
  comentario: string;
  decisionHumana: string;
  decisionHumanaPuntaje?: { tipo: 'asignado' | 'puntaje-original-aceptado'; valor: number };
  responsable?: string;
  historial: {
    fecha: string;
    actor: string;
    estado: EstadoRevisionDemo;
    decision: string;
    comentario: string;
    puntaje?: number;
  }[];
}

/** Proyecta los puntajes sin tratar los valores heredados como CVSS ni como puntaje determinista confirmado. */
export function proyectarPuntajesRevision(revision: RevisionDemo): PuntajesRevisionInternos {
  if (revision.evaluacion) return revision.evaluacion;
  return {
    puntajeOriginal: null,
    puntajeDeterminista: null,
    escala: 'Escala no especificada',
    opinionesJuez: [],
  };
}

/** Explicit judge opinions of a review (the legacy single-opinion projection of the prototype is gone). */
export function obtenerOpinionesJuez(revision: RevisionDemo): OpinionJuezInterna[] {
  return revision.evaluacion?.opinionesJuez ?? [];
}

@Injectable({ providedIn: 'root' })
export class SupervisionAgentes {
  readonly perfil = signal<PerfilConservador>('Medio');
  readonly parametrosPersonalizados = signal<ParametrosPersonalizadosDemo>({
    autonomia: 70,
    revision: 55,
    cautela: 40,
  });
  readonly herramientas = signal([
    { nombre: 'Base de conocimiento', habilitada: true },
    { nombre: 'Inventario TI', habilitada: true },
    { nombre: 'Monitoreo', habilitada: true },
    { nombre: 'Reportes', habilitada: true },
    { nombre: 'Integraciones API', habilitada: true },
  ]);
  readonly revisiones = signal<RevisionDemo[]>([]);

  tickets: TicketDemo[] = [];

  ejecuciones: EjecucionDemo[] = [];
}
