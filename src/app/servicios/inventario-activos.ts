import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, tap, throwError } from 'rxjs';
import { API_CONFIG } from '../config/api.config';

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

@Injectable({ providedIn: 'root' })
export class InventarioActivos {
  private http = inject(HttpClient);
  private readonly endpoint = `${API_CONFIG.baseUrl}/activos`;

  activos: ActivoInventario[] = [];

  cargar(): Observable<ActivoInventario[]> {
    if (!API_CONFIG.usarApi) return of(this.activos);
    return this.http.get<ActivoInventario[]>(this.endpoint).pipe(
      tap(activos => this.activos = activos),
      catchError(error => {
        this.activos = [];
        return throwError(() => error);
      })
    );
  }

  agregar(datos: DatosNuevoActivo): Observable<ActivoInventario> {
    if (API_CONFIG.usarApi) {
      return this.http.post<ActivoInventario>(this.endpoint, datos).pipe(
        tap(activo => this.activos.unshift(activo))
      );
    }

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
      estado: datos.estado
    };
    this.activos.unshift(activo);
    return of(activo);
  }

  asignarPropietario(id: string, propietario: string): Observable<ActivoInventario> {
    const solicitud = API_CONFIG.usarApi
      ? this.http.patch<ActivoInventario>(`${this.endpoint}/${encodeURIComponent(id)}`, { propietario })
      : of(this.activos.find(activo => activo.id === id)!);

    return solicitud.pipe(tap(activo => {
      activo.propietario = propietario;
    }));
  }
}
