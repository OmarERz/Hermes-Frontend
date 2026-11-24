import { Injectable, signal } from '@angular/core';

export type TipoFeedInteligencia = 'Amenazas' | 'Vulnerabilidades';
export type EstadoSincronizacionFeed = 'sin-datos' | 'sincronizado' | 'pendiente' | 'error';

/** Modelo interno de presentación; aún no representa un contrato del backend. */
export interface FeedInteligencia {
  id: string;
  nombre: string;
  tipo: TipoFeedInteligencia;
  descripcion: string;
  proveedor: string;
  activo: boolean;
  frecuenciaActualizacion: string | null;
  ultimaSincronizacion: string | null;
  estadoSincronizacion: EstadoSincronizacionFeed | null;
  cobertura: string | null;
  severidad: string | null;
}

/**
 * Intelligence feeds. The backend has no feeds contract yet (the sources of `GET /api/sources` are a different
 * thing), so the list stays empty and the integration pending.
 */
@Injectable({ providedIn: 'root' })
export class FeedsInteligenciaServicio {
  readonly integracionPendiente = signal(true);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly feeds = signal<FeedInteligencia[]>([]);

  /** Without the backend there is nothing to change; returns whether the change was applied. */
  cambiarEstado(id: string, activo: boolean): boolean {
    if (this.integracionPendiente() || !this.feeds().some((feed) => feed.id === id)) return false;
    this.feeds.update((feeds) =>
      feeds.map((feed) => (feed.id === id ? { ...feed, activo } : feed)),
    );
    return true;
  }
}
