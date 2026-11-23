import { Injectable, signal } from '@angular/core';

export type EstadoTicketDemo = 'Pendiente' | 'En ejecución' | 'Completado' | 'Rechazado' | 'Revisión humana' | 'Reasignado';
export type EstadoRevisionDemo = 'Pendiente de revisión' | 'Marcado para revisión' | 'En revisión humana' | 'Revisado por humano' | 'Resuelto';
export type PerfilConservador = 'Bajo' | 'Medio' | 'Alto' | 'Personalizado';

/** Valores provisionales de demostración; no representan controles reales del agente. */
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
  historial: { fecha: string; actor: string; estado: EstadoRevisionDemo; decision: string; comentario: string; puntaje?: number }[];
}

/** Proyecta los puntajes sin tratar los valores heredados como CVSS ni como puntaje determinista confirmado. */
export function proyectarPuntajesRevision(revision: RevisionDemo): PuntajesRevisionInternos {
  if (revision.evaluacion) return revision.evaluacion;
  return {
    puntajeOriginal: null,
    puntajeDeterminista: null,
    escala: 'Demostración · escala no especificada',
    opinionesJuez: []
  };
}

/** Devuelve opiniones explícitas o representa el criterio demo legado como una sola opinión sin puntaje. */
export function obtenerOpinionesJuez(revision: RevisionDemo, modoDemo: boolean): OpinionJuezInterna[] {
  if (revision.evaluacion) return revision.evaluacion.opinionesJuez;
  if (!modoDemo || (!revision.decisionJuez && !revision.motivoDecision)) return [];
  return [{
    id: `demo-${revision.id}`,
    puntaje: null,
    opinion: revision.decisionJuez,
    justificacion: revision.motivoDecision,
    estado: revision.estadoRevision
  }];
}

@Injectable({ providedIn: 'root' })
export class SupervisionAgentes {
  readonly perfil = signal<PerfilConservador>('Medio');
  readonly parametrosPersonalizados = signal<ParametrosPersonalizadosDemo>({ autonomia: 70, revision: 55, cautela: 40 });
  readonly herramientas = signal([
    { nombre: 'Base de conocimiento', habilitada: true },
    { nombre: 'Inventario TI', habilitada: true },
    { nombre: 'Monitoreo', habilitada: true },
    { nombre: 'Reportes', habilitada: true },
    { nombre: 'Integraciones API', habilitada: true }
  ]);
  readonly revisiones = signal<RevisionDemo[]>([
    { id: 'REC-DEMO-31', ticketId: 'TCK-DEMO-1042', agente: 'Agente de clasificación', estadoAnterior: 'Pendiente', estadoPropuesto: 'En revisión', analisis: 'La solicitud menciona un servicio crítico, pero falta confirmar el impacto.', justificacion: 'Se recomienda una revisión antes de cerrar el ticket.', puntajeAnterior: 5.4, puntajePropuesto: 6.1, decisionJuez: 'Escalar a humano', motivoDecision: 'Información insuficiente para el cierre automático.', estadoRevision: 'Pendiente de revisión', motivoRevision: 'Confirmar criticidad con el responsable.', comentario: '', decisionHumana: '', responsable: 'Equipo de soporte', historial: [] },
    { id: 'REC-DEMO-32A', ticketId: 'TCK-DEMO-1043', agente: 'Agente de diagnóstico A', estadoAnterior: 'Abierto', estadoPropuesto: 'Resuelto', analisis: 'La alerta coincide con una incidencia conocida.', justificacion: 'Los registros muestran recuperación del servicio.', puntajeAnterior: 7.8, puntajePropuesto: 4.2, decisionJuez: 'En desacuerdo', motivoDecision: 'El cierre podría ser prematuro mientras no se confirme la estabilidad en todas las zonas.', estadoRevision: 'Marcado para revisión', motivoRevision: 'Los dos jueces discrepan sobre si la recuperación observada permite cerrar la incidencia.', comentario: '', decisionHumana: '', responsable: 'Mesa de servicio', historial: [], evaluacion: { puntajeOriginal: 7.8, puntajeDeterminista: 7.5, escala: 'Escala de demostración, sin versión CVSS confirmada', opinionesJuez: [{ id: 'JUDGE-DEMO-1', puntaje: 4.2, escala: 'Escala de demostración, sin versión CVSS confirmada', opinion: 'En desacuerdo', estado: 'Recomienda resolución', analisis: 'La alerta coincide con una incidencia conocida. Los registros recientes muestran recuperación y no hay nuevas alertas durante la ventana observada.', justificacion: 'La evidencia disponible respalda resolver el caso, aunque conviene documentar que la verificación cubrió la zona primaria.' }] } },
    { id: 'REC-DEMO-32B', ticketId: 'TCK-DEMO-1043', agente: 'Agente de diagnóstico B', estadoAnterior: 'Abierto', estadoPropuesto: 'En seguimiento', analisis: 'La recuperación aún no se ha confirmado en todas las zonas.', justificacion: 'Mantener seguimiento evita cerrar antes de validar estabilidad.', puntajeAnterior: 7.8, puntajePropuesto: 6.9, decisionJuez: 'En desacuerdo', motivoDecision: 'Se recomienda mantener seguimiento hasta completar la verificación distribuida.', estadoRevision: 'En revisión humana', motivoRevision: 'Los dos jueces discrepan sobre si la recuperación observada permite cerrar la incidencia.', comentario: '', decisionHumana: '', responsable: 'Operaciones TI', historial: [], evaluacion: { puntajeOriginal: 7.8, puntajeDeterminista: 7.5, escala: 'Escala de demostración, sin versión CVSS confirmada', opinionesJuez: [{ id: 'JUDGE-DEMO-2', puntaje: 6.9, escala: 'Escala de demostración, sin versión CVSS confirmada', opinion: 'En desacuerdo', estado: 'Recomienda seguimiento', analisis: 'La recuperación todavía no aparece confirmada en todas las zonas. Persisten eventos intermitentes en una réplica secundaria.', justificacion: 'Mantener el caso en seguimiento permite verificar estabilidad distribuida antes de resolverlo y evita perder trazabilidad de los eventos residuales.' }] } }
  ]);

  tickets: TicketDemo[] = [
    { id: 'TCK-DEMO-1042', agente: 'Agente de clasificación', estado: 'Revisión humana', creado: '2026-11-17 09:12', responsable: 'Equipo de soporte', escalado: true, reasignado: false },
    { id: 'TCK-DEMO-1043', agente: 'Agente de diagnóstico A/B', estado: 'Pendiente', creado: '2026-11-17 09:36', responsable: 'Mesa de servicio', escalado: true, reasignado: true },
    { id: 'TCK-DEMO-1044', agente: 'Agente de inventario', estado: 'En ejecución', creado: '2026-11-17 10:05', responsable: 'Operaciones TI', escalado: false, reasignado: false },
    { id: 'TCK-DEMO-1045', agente: 'Agente de clasificación', estado: 'Completado', creado: '2026-11-17 10:20', responsable: 'Equipo de soporte', escalado: false, reasignado: false, minutosResolucion: 42 },
    { id: 'TCK-DEMO-1046', agente: 'Agente de diagnóstico', estado: 'Rechazado', creado: '2026-11-17 10:44', responsable: 'Seguridad TI', escalado: false, reasignado: false }
  ];

  ejecuciones: EjecucionDemo[] = [
    { id: 'RUN-DEMO-8801', fecha: '2026-11-17 09:13', agente: 'Agente de clasificación', ticketId: 'TCK-DEMO-1042', accion: 'Clasificar solicitud', estadoInicial: 'Pendiente', estadoFinal: 'Revisión humana', resultado: 'Escalado', duracionSegundos: 2.4, herramientas: ['Base de conocimiento', 'Monitoreo'], recomendacionId: 'REC-DEMO-31', decisionJuez: 'Escalar a humano', intervencionHumana: 'Pendiente', error: 'Sin error', tipo: 'Ejecución' },
    { id: 'RUN-DEMO-8802', fecha: '2026-11-17 09:37', agente: 'Agente de diagnóstico A', ticketId: 'TCK-DEMO-1043', accion: 'Analizar alerta', estadoInicial: 'Abierto', estadoFinal: 'Resuelto propuesto', resultado: 'Propuesta generada', duracionSegundos: 4.1, herramientas: ['Monitoreo', 'Reportes'], recomendacionId: 'REC-DEMO-32A', decisionJuez: 'En desacuerdo', intervencionHumana: 'Marcado para revisión', error: 'Sin error', tipo: 'Recomendación' },
    { id: 'RUN-DEMO-8803', fecha: '2026-11-17 09:38', agente: 'Agente de diagnóstico B', ticketId: 'TCK-DEMO-1043', accion: 'Validar estabilidad', estadoInicial: 'Abierto', estadoFinal: 'Seguimiento propuesto', resultado: 'Propuesta alternativa', duracionSegundos: 3.6, herramientas: ['Monitoreo'], recomendacionId: 'REC-DEMO-32B', decisionJuez: 'En desacuerdo', intervencionHumana: 'Pendiente', error: 'Sin error', tipo: 'Recomendación' },
    { id: 'RUN-DEMO-8804', fecha: '2026-11-17 10:21', agente: 'Agente de clasificación', ticketId: 'TCK-DEMO-1045', accion: 'Resolver solicitud', estadoInicial: 'En ejecución', estadoFinal: 'Completado', resultado: 'Correcto', duracionSegundos: 1.9, herramientas: ['Base de conocimiento'], recomendacionId: 'Sin recomendación', decisionJuez: 'No requerido', intervencionHumana: 'No requerida', error: 'Sin error', tipo: 'Ejecución' },
    { id: 'RUN-DEMO-8805', fecha: '2026-11-17 10:45', agente: 'Agente de inventario', ticketId: 'TCK-DEMO-1046', accion: 'Validar solicitud', estadoInicial: 'Pendiente', estadoFinal: 'Rechazado', resultado: 'Rechazado', duracionSegundos: 2.7, herramientas: ['Inventario TI'], recomendacionId: 'Sin recomendación', decisionJuez: 'No requerido', intervencionHumana: 'No requerida', error: 'Validación insuficiente', tipo: 'Ejecución' }
  ];

  guardarPerfilDemo(perfil: PerfilConservador): void { this.perfil.set(perfil); }

  /** Conserva los porcentajes editados en estado demo sin enviarlos a un agente real. */
  guardarParametrosPersonalizadosDemo(parametros: ParametrosPersonalizadosDemo): void {
    this.parametrosPersonalizados.set({ ...parametros });
  }

  cambiarHerramientaDemo(nombre: string, habilitada: boolean): void {
    this.herramientas.update(lista => lista.map(item => item.nombre === nombre ? { ...item, habilitada } : item));
  }

  registrarCambioConfiguracionDemo(cambios: { nombre: string; anterior: string; nuevo: string }[]): void {
    const fecha = new Date().toISOString();
    this.ejecuciones = [{ id: `CFG-DEMO-${Date.now()}`, fecha, agente: 'Agente de Hermes Control', ticketId: 'Sin ticket', accion: cambios.map(item => `${item.nombre}: ${item.anterior} → ${item.nuevo}`).join('; '), estadoInicial: 'Configuración anterior', estadoFinal: 'Vista previa aplicada', resultado: 'Confirmación demo', duracionSegundos: 0, herramientas: [], recomendacionId: 'No aplica', decisionJuez: 'No aplica', intervencionHumana: 'Confirmada por Usuario demo', error: 'Sin error', tipo: 'Configuración', actor: 'Usuario demo' }, ...this.ejecuciones];
  }

  /** Registra una decisión HITL solo en memoria demo y mantiene intactos los puntajes evaluados. */
  actualizarRevisionDemo(id: string, estadoRevision: EstadoRevisionDemo, decisionHumana: string, comentario: string, decisionHumanaPuntaje?: RevisionDemo['decisionHumanaPuntaje'], etiquetaDecision = decisionHumana): void {
    this.revisiones.update(lista => lista.map(item => {
      if (item.id !== id) return item;
      const fecha = new Date().toISOString();
      if (decisionHumana === 'accept-recommendation' || decisionHumana === 'reject-recommendation') {
        this.tickets = this.tickets.map(ticket => ticket.id !== item.ticketId ? ticket : {
          ...ticket,
          estado: decisionHumana === 'accept-recommendation' ? 'Completado' : 'Rechazado'
        });
      }
      return { ...item, estadoRevision, decisionHumana, comentario, decisionHumanaPuntaje, historial: [...item.historial, { fecha, actor: 'Usuario demo', estado: estadoRevision, decision: etiquetaDecision, comentario, puntaje: decisionHumanaPuntaje?.valor }] };
    }));
  }
}
