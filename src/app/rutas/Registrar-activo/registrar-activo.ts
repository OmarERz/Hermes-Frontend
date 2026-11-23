import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { InventarioActivos } from '../../servicios/inventario-activos';

@Component({
  selector: 'app-registrar-activo',
  imports: [FormsModule],
  templateUrl: './registrar-activo.html',
  styleUrl: './registrar-activo.css'
})
export class RegistrarActivo {
  private router = inject(Router);
  private inventario = inject(InventarioActivos);
  activo = {
    nombre: '',
    tipo: 'Computadora',
    codigo: 'ACT-000123',
    estado: 'En uso',
    propietario: '',
    area: '',
    ubicacion: '',
    cpu: '',
    gpu: '',
    ram: 32,
    almacenamiento: 1,
    sistema: 'Windows 11 Pro',
    version: '23H2',
    descripcion: ''
  };

  tipos = ['Computadora', 'Monitor', 'Impresora', 'Equipo de red'];
  guardando = false;
  errorRegistro = '';
  estados = ['En uso', 'En reparación', 'En almacén', 'De baja'];

  registrar() {
    this.guardando = true;
    this.errorRegistro = '';
    this.inventario.agregar(this.activo).subscribe({
      next: () => this.router.navigate(['/activos']),
      error: () => {
        this.guardando = false;
        this.errorRegistro = 'No se pudo registrar el activo. Revisa los datos o la conexión con el servidor.';
      }
    });
  }

  cancelar() { this.router.navigate(['/activos']); }
}
