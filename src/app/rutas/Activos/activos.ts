import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InventarioActivos } from '../../servicios/inventario-activos';
import { OrigenDashboard } from '../../servicios/origen-dashboard';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { LucideActivity, LucideArrowLeft, LucideArrowRight, LucideCalendar, LucideChevronDown, LucideCircleCheck, LucideCpu, LucideDatabase, LucideDynamicIcon, LucideEllipsisVertical, LucideFunnel, LucideLayers, LucideLaptop, LucideMonitor, LucideNetwork, LucideSearch, LucideServer, LucideSlidersHorizontal, LucideTriangleAlert, LucideUsers, LucideWrench, LucideZap } from '@lucide/angular';

@Component({
  selector: 'app-activos',
  imports: [FormsModule, BannerPagina, LucideDynamicIcon, LucideActivity, LucideArrowLeft, LucideArrowRight, LucideCalendar, LucideChevronDown, LucideEllipsisVertical, LucideFunnel, LucideLayers, LucideSearch, LucideSlidersHorizontal, LucideTriangleAlert, LucideUsers, LucideZap],
  templateUrl: './activos.html'
})
export class Activos implements OnInit {
  readonly iconoBanner = LucideMonitor;
  private inventario = inject(InventarioActivos);
  readonly origen = inject(OrigenDashboard);
  busqueda = '';
  tipoFiltro = 'Todos';
  estadoFiltro = 'Todos';
  pagina = 1;
  filasPorPagina = 5;
  cargando = false;
  errorCarga = '';
  mostrarInventario = true;
  mostrarModalAsignacion = false;
  activoSeleccionado = '';
  nuevoPropietario = '';
  mensajeAsignacion = '';
  get activos() { return this.origen.modo() === 'demo' ? this.origen.activos : this.inventario.activos; }
  get totalActivos() { return this.activos.length; }
  get propietariosAsignados() { return new Set(this.activos.map(activo => activo.propietario).filter(nombre => nombre && nombre !== 'Sin asignar')).size; }
  get areasRegistradas() { return new Set(this.activos.map(activo => activo.area).filter(Boolean)).size; }
  get distribucion() {
    const tipos = Array.from(new Set(this.activos.map(activo => activo.tipo)));
    const iconos = { Computadora: LucideLaptop, Servidor: LucideServer, 'Equipo de red': LucideNetwork, Almacenamiento: LucideDatabase, Monitor: LucideMonitor, ASIC: LucideCpu };
    let porcentajeAcumulado = 0;
    return tipos.map((nombre, index) => {
      const total = this.activos.filter(activo => activo.tipo === nombre).length;
      const porcentaje = !this.totalActivos ? 0 : index === tipos.length - 1 ? 100 - porcentajeAcumulado : Math.round(total / this.totalActivos * 100);
      porcentajeAcumulado += porcentaje;
      return { nombre: nombre === 'Computadora' ? 'Computadoras' : nombre, total, porcentaje, icono: iconos[nombre as keyof typeof iconos] ?? LucideLayers };
    });
  }
  get distribucionEstado() {
    const estados = [
      { estado: 'En uso', icono: LucideCircleCheck },
      { estado: 'Mantenimiento', icono: LucideWrench },
      { estado: 'Disponible', icono: LucideLayers }
    ];
    return estados.map(({ estado, icono }) => {
      const total = this.activos.filter(activo => activo.estado === estado).length;
      const porcentaje = this.totalActivos === 0 ? 0 : Math.round(total / this.totalActivos * 100);
      return { estado, icono, total, porcentaje };
    });
  }

  ngOnInit() {
    this.cargando = true;
    this.inventario.cargar().subscribe({
      next: () => this.cargando = false,
      error: () => {
        this.cargando = false;
        this.errorCarga = 'No se pudo cargar el inventario. Revisa la conexión con el servidor.';
      }
    });
  }

  iconoEstado(estado: string) {
    if (estado === 'En uso') return LucideCircleCheck;
    if (estado === 'Mantenimiento') return LucideWrench;
    if (estado === 'Disponible') return LucideLayers;
    return LucideTriangleAlert;
  }

  get filtrados() {
    const texto = this.busqueda.toLocaleLowerCase();
    return this.activos.filter(activo =>
      (!texto || `${activo.id} ${activo.nombre} ${activo.propietario} ${activo.area}`.toLocaleLowerCase().includes(texto)) &&
      (this.tipoFiltro === 'Todos' || activo.tipo === this.tipoFiltro) &&
      (this.estadoFiltro === 'Todos' || activo.estado === this.estadoFiltro)
    );
  }

  get activosVisibles() {
    const inicio = (this.pagina - 1) * this.filasPorPagina;
    return this.filtrados.slice(inicio, inicio + this.filasPorPagina);
  }

  get totalPaginas() {
    return Math.max(1, Math.ceil(this.filtrados.length / this.filasPorPagina));
  }

  reiniciarPagina() { this.pagina = 1; }

  abrirAsignacion() {
    this.activoSeleccionado = this.activos[0]?.id ?? '';
    this.nuevoPropietario = this.activos[0]?.propietario ?? '';
    this.mensajeAsignacion = '';
    this.mostrarModalAsignacion = true;
  }

  seleccionarActivo(id: string) {
    this.nuevoPropietario = this.activos.find(activo => activo.id === id)?.propietario ?? '';
  }

  guardarPropietario() {
    if (this.origen.modo() === 'demo') return;
    if (!this.activoSeleccionado || !this.nuevoPropietario.trim()) return;
    this.inventario.asignarPropietario(this.activoSeleccionado, this.nuevoPropietario.trim()).subscribe({
      next: () => {
        this.mostrarModalAsignacion = false;
        this.mensajeAsignacion = 'Propietario actualizado.';
      },
      error: () => this.mensajeAsignacion = 'No se pudo actualizar el propietario.'
    });
  }
}
