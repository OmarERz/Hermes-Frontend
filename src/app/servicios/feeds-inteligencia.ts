import { Injectable, computed, inject, signal } from '@angular/core';
import { ModoDashboard, OrigenDashboard } from './origen-dashboard';

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

const FEEDS_DEMO: FeedInteligencia[] = [
  {
    id: 'alienvault-otx',
    nombre: 'AlienVault OTX',
    tipo: 'Amenazas',
    proveedor: 'AlienVault / LevelBlue',
    descripcion: 'Inteligencia colaborativa sobre amenazas e indicadores de compromiso.',
    activo: true,
    frecuenciaActualizacion: 'Cada 5 min (ejemplo)',
    ultimaSincronizacion: null,
    estadoSincronizacion: 'sin-datos',
    cobertura: 'Indicadores de compromiso y campañas',
    severidad: 'Todas las severidades',
  },
  {
    id: 'abuseipdb',
    nombre: 'AbuseIPDB',
    tipo: 'Amenazas',
    proveedor: 'AbuseIPDB',
    descripcion:
      'Información comunitaria sobre direcciones IP reportadas por actividades maliciosas.',
    activo: true,
    frecuenciaActualizacion: 'Cada 15 min (ejemplo)',
    ultimaSincronizacion: null,
    estadoSincronizacion: 'sin-datos',
    cobertura: 'Direcciones IP reportadas',
    severidad: 'Abuso reportado',
  },
  {
    id: 'misp-demo',
    nombre: 'MISP Threat Intelligence',
    tipo: 'Amenazas',
    proveedor: 'Fuente MISP de demostración',
    descripcion: 'Intercambio estructurado de indicadores de amenazas.',
    activo: false,
    frecuenciaActualizacion: 'Cada 30 min (ejemplo)',
    ultimaSincronizacion: null,
    estadoSincronizacion: 'sin-datos',
    cobertura: 'Indicadores estructurados de amenazas',
    severidad: 'Todas las severidades',
  },
  {
    id: 'cisa-kev',
    nombre: 'CISA KEV',
    tipo: 'Vulnerabilidades',
    proveedor: 'CISA',
    descripcion: 'Catálogo de vulnerabilidades conocidas como explotadas.',
    activo: true,
    frecuenciaActualizacion: 'Cada 12 h (ejemplo)',
    ultimaSincronizacion: null,
    estadoSincronizacion: 'sin-datos',
    cobertura: 'Vulnerabilidades conocidas como explotadas',
    severidad: 'Alta y crítica',
  },
  {
    id: 'nvd-cve',
    nombre: 'NVD CVE',
    tipo: 'Vulnerabilidades',
    proveedor: 'NIST',
    descripcion: 'Información estructurada sobre vulnerabilidades conocidas.',
    activo: true,
    frecuenciaActualizacion: 'Cada 24 h (ejemplo)',
    ultimaSincronizacion: null,
    estadoSincronizacion: 'sin-datos',
    cobertura: 'Vulnerabilidades CVE publicadas',
    severidad: 'Todas las severidades',
  },
  {
    id: 'snyk-vulnerabilities',
    nombre: 'Snyk Vulnerabilities',
    tipo: 'Vulnerabilidades',
    proveedor: 'Snyk',
    descripcion: 'Información sobre vulnerabilidades en componentes y dependencias de software.',
    activo: false,
    frecuenciaActualizacion: 'Cada 6 h (ejemplo)',
    ultimaSincronizacion: null,
    estadoSincronizacion: 'sin-datos',
    cobertura: 'Componentes y dependencias de software',
    severidad: 'Variable según componente',
  },
];

@Injectable({ providedIn: 'root' })
export class FeedsInteligenciaServicio {
  private readonly origen = inject(OrigenDashboard);
  private readonly feedsDemo = signal<FeedInteligencia[]>(FEEDS_DEMO.map((feed) => ({ ...feed })));

  readonly modo = computed<ModoDashboard>(() => this.origen.modo());
  readonly integracionPendiente = computed(() => this.modo() === 'real');
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly feeds = computed<FeedInteligencia[]>(() =>
    this.modo() === 'demo' ? this.feedsDemo() : [],
  );

  /** Cambia el estado de un feed solo en la fuente de demostración en memoria. */
  cambiarEstadoDemo(id: string, activo: boolean): boolean {
    if (this.modo() !== 'demo' || !this.feedsDemo().some((feed) => feed.id === id)) return false;
    this.feedsDemo.update((feeds) =>
      feeds.map((feed) => (feed.id === id ? { ...feed, activo } : feed)),
    );
    return true;
  }
}
