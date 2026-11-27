import type { ChipTone } from '../../shared/chip';
import type { InstalledSoftware, InventoryAsset, SoftwareLicence } from './inventory.service';

export type Criticality = InventoryAsset['criticality'];
export type SoftwareCategory = NonNullable<InstalledSoftware['category']>;
/** Status of an installation in iTop; `unknown` is the catalogue's key for «no data». */
export type InstallStatus = NonNullable<InstalledSoftware['status']> | 'unknown';
/** Keys of `by_exposure` in the inventory summary. */
export type Exposure = 'exposed' | 'internal' | 'unknown';

/** Spanish names of the backend enums (their OpenAPI descriptions), most to least urgent. */
export const CRITICALITY_LABELS: Record<Criticality, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
  unknown: 'Sin dato',
};
export const CRITICALITIES = Object.keys(CRITICALITY_LABELS) as Criticality[];

/** The category of an installation is its real iTop class (D-088): Spanish name, iTop class as given. */
export const CATEGORY_LABELS: Record<SoftwareCategory, string> = {
  DBServer: 'Servidor de base de datos',
  Middleware: 'Middleware',
  OtherSoftware: 'Otro software',
  PCSoftware: 'Software de PC',
  WebServer: 'Servidor web',
};
export const CATEGORIES = Object.keys(CATEGORY_LABELS) as SoftwareCategory[];

export const INSTALL_STATUS_LABELS: Record<InstallStatus, string> = {
  active: 'Activa',
  inactive: 'Inactiva',
  unknown: 'Sin dato',
};
export const INSTALL_STATUSES = Object.keys(INSTALL_STATUS_LABELS) as InstallStatus[];
/** Chip tone of an installation status (G10: the semantic colours, in the shared chip). */
export const INSTALL_STATUS_TONES: Record<InstallStatus, ChipTone> = {
  active: 'success',
  inactive: 'warning',
  unknown: 'neutral',
};

export const EXPOSURE_LABELS: Record<Exposure, string> = {
  exposed: 'Expuestos a internet',
  internal: 'Internos',
  unknown: 'Sin dato',
};
export const EXPOSURES = Object.keys(EXPOSURE_LABELS) as Exposure[];

/**
 * Spanish names of the usual iTop CI classes; any other class (a subclass of the instance) is shown as iTop
 * names it.
 */
const ITOP_CLASS_LABELS: Record<string, string> = {
  Server: 'Servidor',
  VirtualMachine: 'Máquina virtual',
  PC: 'Computadora',
  Hypervisor: 'Hipervisor',
  NetworkDevice: 'Equipo de red',
  StorageSystem: 'Almacenamiento',
  ApplicationSolution: 'Solución de aplicación',
  WebApplication: 'Aplicación web',
  DatabaseSchema: 'Esquema de base de datos',
  BusinessProcess: 'Proceso de negocio',
};

/** The Spanish name of an iTop class, or the class itself. */
export function itopClassLabel(itopClass: string | null | undefined): string {
  if (!itopClass) return 'Sin dato';
  return ITOP_CLASS_LABELS[itopClass] ?? itopClass;
}

/** The classes that carry CPU, RAM and an OS in Hermes (ESC-03): the ones offered to create in iTop. */
export const HOST_CLASSES = ['Server', 'VirtualMachine'] as const;

/** «Sí», «No» or «Sin dato» for the nullable booleans of iTop (exposure, personal data). */
export function yesNo(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return 'Sin dato';
  return value ? 'Sí' : 'No';
}

export function exposureLabel(exposed: boolean | null | undefined): string {
  if (exposed === null || exposed === undefined) return 'Sin dato';
  return exposed ? 'Expuesto' : 'Interno';
}

/** iTop free text (CPU, RAM, OS…), shown as given; a dash when iTop has nothing. */
export function text(value: string | null | undefined): string {
  return value?.trim() ? value : '—';
}

const DAY_FORMAT = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' });

/** A `YYYY-MM-DD` date of iTop as a calendar day (no time zone shift). */
export function formatDay(day: string | null | undefined): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day ?? '');
  if (!parts) return day ?? '—';
  return DAY_FORMAT.format(new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])));
}

/** How long a licence lasts, from its iTop dates: perpetual, a range, only an end or only a start. */
export function licenceValidity(
  licence: Pick<SoftwareLicence, 'perpetual' | 'start_date' | 'end_date'>,
): string {
  if (licence.perpetual) return 'Perpetua';
  if (licence.end_date && licence.start_date)
    return `Del ${formatDay(licence.start_date)} al ${formatDay(licence.end_date)}`;
  if (licence.end_date) return `Vence el ${formatDay(licence.end_date)}`;
  if (licence.start_date)
    return `Desde el ${formatDay(licence.start_date)}, sin vencimiento en iTop`;
  return 'Sin fechas en iTop';
}

/** «1 instalación», «3 instalaciones»… */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The share of `part` in `total` as a whole percent (0 when the total is 0). */
export function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
