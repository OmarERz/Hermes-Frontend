import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export interface ActivoInventario {
  id: string;
  nombre: string;
  subtitulo: string;
  tipo: string;
  cpu: string;
  gpu: string;
  ram: string;
  almacenamiento: string;
  sistema: string;
  propietario: string;
  area: string;
  estado: string;
}

export interface DatosNuevoActivo {
  nombre: string;
  tipo: string;
  codigo: string;
  estado: string;
  propietario: string;
  area: string;
  ubicacion: string;
  cpu: string;
  gpu: string;
  ram: number;
  almacenamiento: number;
  sistema: string;
  version: string;
  descripcion: string;
}

/**
 * In-memory asset inventory of the prototype screens (Activos, Registrar activo). The backend has no assets
 * write route yet (D-087: the user decides which prototype features get one), so nothing is sent anywhere and
 * the list starts empty on every load.
 */
@Injectable({ providedIn: 'root' })
export class InventarioActivos {
  activos: ActivoInventario[] = [];

  cargar(): Observable<ActivoInventario[]> {
    return of(this.activos);
  }

  agregar(datos: DatosNuevoActivo): Observable<ActivoInventario> {
    const activo: ActivoInventario = {
      id: datos.codigo || `ACT-${Date.now().toString().slice(-5)}`,
      nombre: datos.nombre || 'Activo nuevo',
      subtitulo: datos.ubicacion || datos.descripcion || 'Activo empresarial',
      tipo: datos.tipo,
      cpu: datos.cpu || '-',
      gpu: datos.gpu || '-',
      ram: `${datos.ram} GB`,
      almacenamiento: `${datos.almacenamiento} TB`,
      sistema: datos.version ? `${datos.sistema} ${datos.version}` : datos.sistema,
      propietario: datos.propietario || 'Sin asignar',
      area: datos.area || 'Sin area',
      estado: datos.estado,
    };
    this.activos.unshift(activo);
    return of(activo);
  }

  asignarPropietario(id: string, propietario: string): Observable<ActivoInventario | undefined> {
    const activo = this.activos.find((item) => item.id === id);
    if (activo) activo.propietario = propietario;
    return of(activo);
  }
}
