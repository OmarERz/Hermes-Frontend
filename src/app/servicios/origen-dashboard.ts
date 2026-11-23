import { Injectable, signal } from '@angular/core';
import { ActivoInventario } from './inventario-activos';
import { CategoriaTecnologia, EstadoTecnologia, LicenciaTecnologia, TecnologiaEmpresa } from './catalogo-tecnologias';

export type ModoDashboard = 'real' | 'demo';

@Injectable({ providedIn: 'root' })
export class OrigenDashboard {
  readonly modo = signal<ModoDashboard>('real');

  readonly agentes = {
    estado: 'Activo',
    modoOperacion: 'Monitoreo',
    motor: 'GPT-4o (Enterprise)',
    ultimaEjecucion: '17 nov, 10:24',
    tasaExito: 97.8,
    tareasCompletadas: 4892,
    respuestaSegundos: 2.4,
    disponibilidad: 99.95,
    incidentes: 3,
    enProceso: 36,
    completadosHoy: 128,
    enCola: 4,
    exitosas: 4784,
    fallidas: 108,
    herramientas: [
      { nombre: 'Monitoreo', porcentaje: 42.7 },
      { nombre: 'Inventario TI', porcentaje: 24.1 },
      { nombre: 'Reportes', porcentaje: 18.5 },
      { nombre: 'Base conocimiento', porcentaje: 9.8 },
      { nombre: 'Integraciones API', porcentaje: 4.9 }
    ],
    dias: ['18 ene', '19 ene', '20 ene', '21 ene', '22 ene', '23 ene', '24 ene'],
    tareas: [450, 520, 600, 670, 740, 805, 900],
    exitos: [97.5, 97.6, 97.7, 98, 98.2, 98.6, 98.8],
    respuestas: [2.7, 2.4, 2.3, 2.2, 2.1, 2, 1.9]
  };

  readonly tecnologias: TecnologiaEmpresa[] = [
    { id: 'demo-1', nombre: 'Angular', categoria: 'Frontend', version: '20', descripcion: 'Portal empresarial', estado: 'En uso', licencia: 'Open source' },
    { id: 'demo-2', nombre: 'Node.js', categoria: 'Backend', version: '22', descripcion: 'Servicios de aplicación', estado: 'En uso', licencia: 'Open source' },
    { id: 'demo-3', nombre: 'PostgreSQL', categoria: 'Base de datos', version: '17', descripcion: 'Persistencia relacional', estado: 'En uso', licencia: 'Open source' },
    { id: 'demo-4', nombre: 'Kubernetes', categoria: 'Infraestructura', version: '1.32', descripcion: 'Orquestación de contenedores', estado: 'En evaluación', licencia: 'Open source' },
    { id: 'demo-5', nombre: 'Power BI', categoria: 'Analítica/IA', version: '2025', descripcion: 'Analítica empresarial', estado: 'En uso', licencia: 'Comercial' },
    { id: 'demo-6', nombre: 'Redis', categoria: 'Backend', version: '7', descripcion: 'Caché de aplicación', estado: 'En evaluación', licencia: 'Open source' }
  ];

  readonly stack = {
    salud: 86,
    calidad: [{ nombre: 'Frontend', valor: 88 }, { nombre: 'Backend', valor: 82 }, { nombre: 'Datos', valor: 91 }, { nombre: 'Infraestructura', valor: 78 }, { nombre: 'Analítica/IA', valor: 84 }],
    madurez: [{ nombre: 'Angular', valor: 4 }, { nombre: 'Node.js', valor: 4 }, { nombre: 'PostgreSQL', valor: 5 }, { nombre: 'Kubernetes', valor: 3 }, { nombre: 'Power BI', valor: 4 }, { nombre: 'Redis', valor: 3 }],
    valorNegocio: [{ nombre: 'Continuidad', valor: 82 }, { nombre: 'Eficiencia', valor: 88 }, { nombre: 'Innovación', valor: 76 }, { nombre: 'Seguridad', valor: 84 }],
  };

  readonly activos: ActivoInventario[] = [
    { id: 'DEMO-001', nombre: 'WS-ENG-045', subtitulo: 'Estación de trabajo', tipo: 'Computadora', cpu: 'Intel i7', gpu: 'NVIDIA RTX 4060', ram: '32 GB', almacenamiento: '1 TB SSD', sistema: 'Windows 11 Pro', propietario: 'Ana Torres', area: 'Ingeniería', estado: 'En uso' },
    { id: 'DEMO-002', nombre: 'SRV-PRD-01', subtitulo: 'Servidor de aplicaciones', tipo: 'Servidor', cpu: 'AMD EPYC', gpu: '-', ram: '256 GB', almacenamiento: '8 TB SSD', sistema: 'Ubuntu 22.04', propietario: 'Carlos Méndez', area: 'Operaciones', estado: 'Mantenimiento' },
    { id: 'DEMO-003', nombre: 'LPT-SLS-022', subtitulo: 'Laptop corporativa', tipo: 'Computadora', cpu: 'Intel i5', gpu: 'Intel Iris Xe', ram: '16 GB', almacenamiento: '512 GB SSD', sistema: 'Windows 11 Pro', propietario: 'Lucía Pérez', area: 'Comercial', estado: 'En uso' },
    { id: 'DEMO-004', nombre: 'GPU-ND-03', subtitulo: 'Nodo de cómputo GPU', tipo: 'ASIC', cpu: 'AMD EPYC', gpu: 'NVIDIA H100', ram: '512 GB', almacenamiento: '30 TB NVMe', sistema: 'Ubuntu 22.04', propietario: 'Javier Rojas', area: 'IA y Datos', estado: 'En uso' },
    { id: 'DEMO-005', nombre: 'STG-SAN-01', subtitulo: 'Almacenamiento SAN', tipo: 'Almacenamiento', cpu: '-', gpu: '-', ram: '-', almacenamiento: '200 TB', sistema: 'Sistema de almacenamiento', propietario: 'María Gómez', area: 'Infraestructura', estado: 'Disponible' },
    { id: 'DEMO-006', nombre: 'MON-DES-112', subtitulo: 'Monitor de diseño', tipo: 'Monitor', cpu: '-', gpu: '-', ram: '-', almacenamiento: '-', sistema: '-', propietario: 'Elena Ruiz', area: 'Diseño', estado: 'En uso' },
    { id: 'DEMO-007', nombre: 'NET-CORE-02', subtitulo: 'Switch de núcleo', tipo: 'Equipo de red', cpu: 'ARM 2.4 GHz', gpu: '-', ram: '16 GB', almacenamiento: '128 GB', sistema: 'Network OS 10', propietario: 'Diego Salas', area: 'Infraestructura', estado: 'En uso' }
  ];

  cambiarModo(modo: ModoDashboard): void { this.modo.set(modo); }
}

export const CATEGORIAS_DASHBOARD: CategoriaTecnologia[] = ['Frontend', 'Backend', 'Base de datos', 'Infraestructura', 'Analítica/IA', 'Otra'];
export const ESTADOS_DASHBOARD: EstadoTecnologia[] = ['En uso', 'En evaluación', 'Descontinuada'];
export const LICENCIAS_DASHBOARD: LicenciaTecnologia[] = ['Open source', 'Comercial', 'Otra'];
