import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideActivity,
  LucideChartColumn,
  LucideCheck,
  LucideCode,
  LucideDatabase,
  LucideDynamicIcon,
  LucideLayers,
  LucideShield,
  LucideShieldAlert,
  LucideShieldCheck,
  LucideSlidersHorizontal,
  LucideTriangleAlert,
  LucideWrench,
} from '@lucide/angular';
import { AyudaTooltip } from '../../componentes/ayuda-tooltip/ayuda-tooltip';
import {
  ParametrosPersonalizadosDemo,
  PerfilConservador,
  SupervisionAgentes,
} from '../../servicios/supervision-agentes';
import { ConfirmChangesDialog } from '../../shared/confirm-changes-dialog';
import type { ChangeRow } from '../../shared/versioned-save';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';

const BACKEND_PENDING_MESSAGE =
  'Pendiente de conectar con el backend: los cambios todavía no se pueden guardar.';

@Component({
  selector: 'app-configuracion-agente',
  imports: [
    RouterLink,
    BannerPagina,
    AyudaTooltip,
    LucideCheck,
    LucideShieldCheck,
    LucideSlidersHorizontal,
    LucideWrench,
    LucideDynamicIcon,
    ConfirmChangesDialog,
  ],
  templateUrl: './configuracion-agente.html',
})
export class ConfiguracionAgente {
  readonly supervision = inject(SupervisionAgentes);
  readonly iconoBanner = LucideSlidersHorizontal;
  readonly perfiles = [
    {
      valor: 'Bajo',
      descripcion: 'Mayor autonomía dentro de los permisos autorizados.',
      icono: LucideShield,
    },
    {
      valor: 'Medio',
      descripcion: 'Equilibrio entre autonomía y revisión.',
      icono: LucideShieldCheck,
    },
    { valor: 'Alto', descripcion: 'Mayor cautela y revisión humana.', icono: LucideShieldAlert },
    {
      valor: 'Personalizado',
      descripcion: 'Ajusta manualmente el comportamiento del agente.',
      icono: LucideSlidersHorizontal,
    },
  ] as const;
  readonly controlesPersonalizados: readonly {
    clave: keyof ParametrosPersonalizadosDemo;
    nombre: string;
    descripcion: string;
    icono: typeof LucideActivity | typeof LucideChartColumn | typeof LucideShieldAlert;
  }[] = [
    {
      clave: 'autonomia',
      nombre: 'Autonomía',
      descripcion: 'Cuánta libertad tiene el agente para tomar decisiones.',
      icono: LucideActivity,
    },
    {
      clave: 'revision',
      nombre: 'Revisión',
      descripcion: 'Qué proporción de acciones se envía a revisión humana.',
      icono: LucideChartColumn,
    },
    {
      clave: 'cautela',
      nombre: 'Cautela',
      descripcion: 'Qué tan conservador es el agente ante incertidumbre o riesgo.',
      icono: LucideShieldAlert,
    },
  ];
  perfilBorrador: PerfilConservador = this.supervision.perfil();
  parametrosPersonalizadosBorrador: ParametrosPersonalizadosDemo = {
    ...this.supervision.parametrosPersonalizados(),
  };
  herramientasBorrador = this.supervision.herramientas().map((item) => ({ ...item }));
  readonly iconoResumenPerfil = LucideLayers;
  readonly iconoResumenHerramientas = LucideWrench;
  readonly iconoResumenIntegracion = LucideTriangleAlert;
  modalAbierto = false;
  mensaje = '';

  /** The agent configuration has no backend route yet: the summary shows "Sin datos" and saving is off. */
  readonly perfilActualResumen = 'Sin datos';
  readonly herramientasActivasResumen = 'Sin datos';
  readonly estadoIntegracion = 'Integración pendiente';

  iconoHerramienta(nombre: string) {
    switch (nombre) {
      case 'Base de conocimiento':
        return LucideDatabase;
      case 'Inventario TI':
        return LucideLayers;
      case 'Monitoreo':
        return LucideActivity;
      case 'Reportes':
        return LucideChartColumn;
      default:
        return LucideCode;
    }
  }

  get cambios(): { nombre: string; anterior: string; nuevo: string; impacto: string }[] {
    const resultado = [];
    if (this.perfilBorrador !== this.supervision.perfil())
      resultado.push({
        nombre: 'Nivel conservador',
        anterior: this.supervision.perfil(),
        nuevo: this.perfilBorrador,
        impacto: 'Pendiente de conectar con el backend.',
      });
    const parametrosActuales = this.supervision.parametrosPersonalizados();
    const parametros = [
      { clave: 'autonomia', nombre: 'Autonomía' },
      { clave: 'revision', nombre: 'Revisión' },
      { clave: 'cautela', nombre: 'Cautela' },
    ] as const;
    for (const parametro of parametros) {
      const anterior = parametrosActuales[parametro.clave];
      const nuevo = this.parametrosPersonalizadosBorrador[parametro.clave];
      if (anterior !== nuevo)
        resultado.push({
          nombre: parametro.nombre,
          anterior: `${anterior}%`,
          nuevo: `${nuevo}%`,
          impacto: 'Pendiente de conectar con el backend.',
        });
    }
    for (const herramienta of this.herramientasBorrador) {
      const anterior = this.supervision
        .herramientas()
        .find((item) => item.nombre === herramienta.nombre)?.habilitada;
      if (anterior !== herramienta.habilitada)
        resultado.push({
          nombre: `Herramienta: ${herramienta.nombre}`,
          anterior: anterior ? 'Habilitada' : 'Deshabilitada',
          nuevo: herramienta.habilitada ? 'Habilitada' : 'Deshabilitada',
          impacto: 'Pendiente de conectar con el backend.',
        });
    }
    return resultado;
  }

  /** The pending changes in the shape of the shared before/after dialog. */
  get changeRows(): ChangeRow[] {
    return this.cambios.map((change) => ({
      name: change.nombre,
      before: change.anterior,
      after: change.nuevo,
      impact: change.impacto,
    }));
  }

  prepararGuardado(): void {
    this.mensaje = BACKEND_PENDING_MESSAGE;
  }

  /** Actualiza un porcentaje del borrador y rechaza valores fuera de 0 a 100 o no enteros. */
  actualizarParametroPersonalizado(
    parametro: keyof ParametrosPersonalizadosDemo,
    evento: Event,
  ): void {
    const valor = Number((evento.target as HTMLInputElement).value);
    if (!Number.isInteger(valor) || valor < 0 || valor > 100) return;
    this.parametrosPersonalizadosBorrador = {
      ...this.parametrosPersonalizadosBorrador,
      [parametro]: valor,
    };
  }

  confirmar(): void {
    this.modalAbierto = false;
    this.mensaje = BACKEND_PENDING_MESSAGE;
  }

  cancelar(): void {
    this.perfilBorrador = this.supervision.perfil();
    this.parametrosPersonalizadosBorrador = { ...this.supervision.parametrosPersonalizados() };
    this.herramientasBorrador = this.supervision.herramientas().map((item) => ({ ...item }));
    this.modalAbierto = false;
  }
}
