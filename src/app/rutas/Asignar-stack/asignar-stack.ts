import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ActivoInventario, InventarioActivos } from '../../servicios/inventario-activos';
import { AsignacionesStack } from '../../servicios/asignaciones-stack';
import { CatalogoTecnologias, TecnologiaEmpresa } from '../../servicios/catalogo-tecnologias';

@Component({
  selector: 'app-asignar-stack',
  imports: [FormsModule, RouterLink],
  templateUrl: './asignar-stack.html',
  styleUrl: './asignar-stack.css',
})
export class AsignarStack implements OnInit {
  private readonly inventario = inject(InventarioActivos);
  private readonly asignacionesStack = inject(AsignacionesStack);
  private readonly catalogo = inject(CatalogoTecnologias);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly tecnologias = this.catalogo.tecnologias;
  get activos(): ActivoInventario[] {
    return this.inventario.activos;
  }
  activoId = '';
  seleccionadas: string[] = [];
  busquedaTecnologia = '';
  mensaje = '';
  error = '';

  ngOnInit(): void {
    this.inventario.cargar().subscribe({
      error: () => (this.error = 'No se pudo cargar la lista de activos.'),
    });
  }

  get tecnologiasFiltradas(): TecnologiaEmpresa[] {
    const texto = this.busquedaTecnologia.trim().toLocaleLowerCase();
    return this.tecnologias().filter(
      (tecnologia) =>
        !texto ||
        `${tecnologia.nombre} ${tecnologia.categoria}`.toLocaleLowerCase().includes(texto),
    );
  }

  seleccionarActivo(): void {
    this.seleccionadas = [...this.asignacionesStack.obtener(this.activoId)];
    this.mensaje = '';
    this.error = '';
  }

  modificarAsignacion(activoId: string): void {
    this.activoId = activoId;
    this.seleccionarActivo();
  }

  alternarTecnologia(id: string, seleccionada: boolean): void {
    this.seleccionadas = seleccionada
      ? [...new Set([...this.seleccionadas, id])]
      : this.seleccionadas.filter((actual) => actual !== id);
  }

  guardar(): void {
    if (!this.activoId) {
      this.error = 'Selecciona un activo para continuar.';
      return;
    }
    this.asignacionesStack.guardar(this.activoId, this.seleccionadas);
    this.error = '';
    this.mensaje = 'Asignación guardada.';
    if (this.route.snapshot.queryParamMap.get('retorno') === 'catalogo') {
      void this.router.navigate(['/stack-tecnologico'], { fragment: 'catalogo' });
    }
  }

  cancelar(): void {
    void this.router.navigate(['/stack-tecnologico'], { fragment: 'catalogo' });
  }

  get asignaciones() {
    return this.asignacionesStack
      .listar()
      .map((asignacion) => ({
        activoId: asignacion.activoId,
        activo: this.activos.find((activo) => activo.id === asignacion.activoId),
        tecnologiaIds: asignacion.tecnologiaIds,
        tecnologias: asignacion.tecnologiaIds
          .map((id) => this.tecnologias().find((tecnologia) => tecnologia.id === id)?.nombre)
          .filter((nombre): nombre is string => !!nombre),
      }))
      .filter((asignacion) => asignacion.activo);
  }
}
