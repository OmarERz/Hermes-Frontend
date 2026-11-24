import { afterNextRender, Injectable, signal } from '@angular/core';

export type CategoriaTecnologia =
  'Frontend' | 'Backend' | 'Base de datos' | 'Infraestructura' | 'Analítica/IA' | 'Otra';
export type EstadoTecnologia = 'En uso' | 'En evaluación' | 'Descontinuada';
export type LicenciaTecnologia = 'Open source' | 'Comercial' | 'Otra';

export interface TecnologiaEmpresa {
  id: string;
  nombre: string;
  categoria: CategoriaTecnologia;
  version: string;
  descripcion: string;
  estado: EstadoTecnologia;
  licencia: LicenciaTecnologia;
}

export type DatosTecnologia = Omit<TecnologiaEmpresa, 'id'>;

@Injectable({ providedIn: 'root' })
export class CatalogoTecnologias {
  private readonly clave = 'hermes-control.catalogo-tecnologias.v1';
  readonly tecnologias = signal<TecnologiaEmpresa[]>([]);

  constructor() {
    afterNextRender(() => this.cargar());
  }

  guardar(datos: DatosTecnologia, id?: string): void {
    const registro: TecnologiaEmpresa = { ...datos, id: id ?? this.nuevoId() };
    this.tecnologias.update((actuales) =>
      id
        ? actuales.map((tecnologia) => (tecnologia.id === id ? registro : tecnologia))
        : [...actuales, registro],
    );
    this.persistir();
  }

  eliminar(id: string): void {
    this.tecnologias.update((actuales) => actuales.filter((tecnologia) => tecnologia.id !== id));
    this.persistir();
  }

  existeDuplicada(nombre: string, excluirId?: string): boolean {
    const normalizado = nombre.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    return this.tecnologias().some(
      (tecnologia) =>
        tecnologia.id !== excluirId &&
        tecnologia.nombre.trim().replace(/\s+/g, ' ').toLocaleLowerCase() === normalizado,
    );
  }

  private cargar(): void {
    try {
      const valor = localStorage.getItem(this.clave);
      if (!valor) return;
      const datos: unknown = JSON.parse(valor);
      if (Array.isArray(datos)) {
        this.tecnologias.set(
          datos.filter(
            (item): item is TecnologiaEmpresa =>
              !!item &&
              typeof item === 'object' &&
              typeof item.id === 'string' &&
              typeof item.nombre === 'string',
          ),
        );
      }
    } catch {
      this.tecnologias.set([]);
    }
  }

  private persistir(): void {
    try {
      localStorage.setItem(this.clave, JSON.stringify(this.tecnologias()));
    } catch {
      // El catálogo sigue disponible en memoria si el navegador bloquea el almacenamiento.
    }
  }

  private nuevoId(): string {
    return (
      globalThis.crypto?.randomUUID?.() ??
      `tec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    );
  }
}

export const TECHNOLOGY_CATEGORIES: CategoriaTecnologia[] = [
  'Frontend',
  'Backend',
  'Base de datos',
  'Infraestructura',
  'Analítica/IA',
  'Otra',
];
export const TECHNOLOGY_STATUSES: EstadoTecnologia[] = ['En uso', 'En evaluación', 'Descontinuada'];
export const TECHNOLOGY_LICENSES: LicenciaTecnologia[] = ['Open source', 'Comercial', 'Otra'];
