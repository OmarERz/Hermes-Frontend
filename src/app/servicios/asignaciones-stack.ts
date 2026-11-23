import { afterNextRender, Injectable, signal } from '@angular/core';

export interface AsignacionTecnologias {
  activoId: string;
  tecnologiaIds: string[];
}

@Injectable({ providedIn: 'root' })
export class AsignacionesStack {
  private readonly clave = 'hermes-control.asignaciones-stack.v1';
  private asignaciones = new Map<string, string[]>();
  private readonly revision = signal(0);

  constructor() {
    afterNextRender(() => this.cargar());
  }

  listar(): AsignacionTecnologias[] {
    this.revision();
    return Array.from(this.asignaciones, ([activoId, tecnologiaIds]) => ({ activoId, tecnologiaIds }));
  }

  obtener(activoId: string): string[] {
    this.revision();
    return this.asignaciones.get(activoId) ?? [];
  }

  guardar(activoId: string, tecnologiaIds: string[]): void {
    this.asignaciones.set(activoId, [...new Set(tecnologiaIds)]);
    this.revision.update(valor => valor + 1);
    this.persistir();
  }

  eliminarTecnologia(tecnologiaId: string): void {
    for (const [activoId, tecnologiaIds] of this.asignaciones) {
      this.asignaciones.set(activoId, tecnologiaIds.filter(id => id !== tecnologiaId));
    }
    this.revision.update(valor => valor + 1);
    this.persistir();
  }

  private cargar(): void {
    try {
      const valor = localStorage.getItem(this.clave);
      if (!valor) return;
      const datos: unknown = JSON.parse(valor);
      if (!Array.isArray(datos)) return;
      this.asignaciones = new Map(datos
        .filter((item): item is AsignacionTecnologias =>
          !!item && typeof item.activoId === 'string' && Array.isArray(item.tecnologiaIds)
        )
        .map(item => [item.activoId, item.tecnologiaIds.filter(id => typeof id === 'string')]));
      this.revision.update(valor => valor + 1);
    } catch {
      this.asignaciones.clear();
    }
  }

  private persistir(): void {
    try {
      localStorage.setItem(this.clave, JSON.stringify(this.listar()));
    } catch {
      // Las asignaciones permanecen en memoria si el navegador bloquea el almacenamiento.
    }
  }
}
