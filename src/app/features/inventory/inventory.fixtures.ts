import type {
  AssetDetail,
  InstalledSoftware,
  InventoryAsset,
  InventoryPending,
  InventorySummary,
  SoftwareItem,
} from './inventory.service';

/**
 * Inventory rows for the specs of this folder, shaped like the backend's demo data (`make demo`): the payments
 * server with its OpenSSL licence, the intranet VM with an inactive installation and the web server without owner.
 */
export const PAYMENTS: InventoryAsset = {
  ci_id: 'CI-1',
  name: 'srv-pagos-01',
  itop_class: 'Server',
  criticality: 'high',
  exposed: true,
  classification: 'highly_classified',
  personal_data: true,
  owner: 'Dueña de Pagos',
  custodian: 'Infraestructura Linux',
  service: 'Pagos',
  os: 'Ubuntu 22.04',
  itop_url: 'https://itop.example.test/pages/UI.php?operation=details&class=Server&id=CI-1',
  synced_at: '2026-11-22T12:00:00Z',
  open_findings: 2,
  kev_findings: 1,
  risk: 92,
  level: 'critical',
  software_count: 1,
  description: 'Servidor de cobros con tarjeta',
  cpu: '16 vCPU',
  ram: '64 GB',
};

export const WEB: InventoryAsset = {
  ci_id: 'CI-3',
  name: 'srv-web-03',
  itop_class: 'Server',
  criticality: 'medium',
  exposed: null,
  classification: 'public',
  personal_data: null,
  owner: null,
  custodian: null,
  service: null,
  os: null,
  itop_url: '',
  synced_at: '2026-11-22T12:00:00Z',
  open_findings: 0,
  kev_findings: 0,
  risk: null,
  level: null,
  software_count: 2,
  description: null,
  cpu: null,
  ram: null,
};

export const SUMMARY: InventorySummary = {
  total_assets: 3,
  by_class: { Server: 2, VirtualMachine: 1 },
  by_criticality: { high: 1, medium: 2 },
  by_exposure: { exposed: 2, internal: 1 },
  by_classification: { highly_classified: 1, classified: 1, public: 1 },
  owners: 1,
  without_owner: 1,
  custodians: 2,
  with_open_findings: 2,
  with_kev_findings: 1,
  last_sync_at: '2026-11-22T12:00:00Z',
  software: {
    total: 3,
    with_cpe: 3,
    with_known_version: 3,
    without_critical: 2,
    cpe_percent: '100.0',
    known_version_percent: '100.0',
    without_critical_percent: '66.7',
  },
};

export const OPENSSL: SoftwareItem = {
  id: '0196a6f0-0000-7000-8000-000000000001',
  name: 'OpenSSL',
  versions: ['3.0.7'],
  version_known: true,
  instances: 3,
  ci_count: 3,
  cpe: 'cpe:2.3:a:openssl:openssl:*:*:*:*:*:*:*:*',
  has_cpe: true,
  open_vulnerabilities: 2,
  worst_level: 'critical',
  categories: ['OtherSoftware', 'WebServer'],
  by_category: { OtherSoftware: 2, WebServer: 1 },
  by_status: { active: 1, inactive: 1, unknown: 1 },
  licences: [
    {
      name: 'Soporte OpenSSL',
      usage_limit: '10 servidores',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      perpetual: false,
      instances: 1,
    },
  ],
  licensed_instances: 1,
};

export const KERNEL: SoftwareItem = {
  id: '0196a6f0-0000-7000-8000-000000000002',
  name: 'Amazon Linux 2023 kernel',
  versions: [],
  version_known: false,
  instances: 1,
  ci_count: 1,
  cpe: null,
  has_cpe: false,
  open_vulnerabilities: 0,
  worst_level: null,
  categories: [],
  by_category: {},
  by_status: { active: 0, inactive: 0, unknown: 1 },
  licences: [],
  licensed_instances: 0,
};

export const INSTALLED_OPENSSL: InstalledSoftware = {
  software_id: OPENSSL.id,
  name: 'OpenSSL',
  version: '3.0.7',
  version_known: true,
  cpe: OPENSSL.cpe,
  has_cpe: true,
  open_vulnerabilities: 2,
  worst_level: 'critical',
  category: 'OtherSoftware',
  status: 'active',
  description: 'Biblioteca TLS del sistema',
  licence: {
    name: 'Soporte OpenSSL',
    usage_limit: '10 servidores',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    perpetual: false,
  },
};

export const INSTALLED_KERNEL: InstalledSoftware = {
  software_id: KERNEL.id,
  name: 'Amazon Linux 2023 kernel',
  version: 'N/A',
  version_known: false,
  cpe: null,
  has_cpe: false,
  open_vulnerabilities: 0,
  worst_level: null,
  category: null,
  status: null,
  description: null,
  licence: null,
};

export const DETAIL: AssetDetail = {
  ci_id: 'CI-1',
  name: 'srv-pagos-01',
  owner: 'Dueña de Pagos',
  custodian: 'Infraestructura Linux',
  classification: 'highly_classified',
  risk: 92,
  itop_class: 'Server',
  description: 'Servidor de cobros con tarjeta',
  cpu: '16 vCPU',
  ram: '64 GB',
  findings: [
    {
      group_id: '7d9f2b1e-0c3a-4f5e-9b8d-1a2b3c4d5e6f',
      cve: 'CVE-2026-10001',
      product: 'OpenSSL 3.0.7',
      ci_count: 2,
      custodians: ['Infraestructura Linux'],
      tickets: ['DEMO-1'],
      final: 92,
      level: 'critical',
      in_kev: true,
      owners: ['Dueña de Pagos'],
      classification: 'highly_classified',
      exposed: true,
      status: 'new',
      last_seen: '2026-11-22T12:00:00Z',
    },
  ],
  software: [],
};

export const PENDING: InventoryPending = {
  software_without_cpe: [
    { ci_id: KERNEL.id, name: KERNEL.name, detail: 'Software sin CPE (1 instalaciones)' },
  ],
  without_classification: [],
  without_exposure: [{ ci_id: 'CI-3', name: 'srv-web-03', detail: 'Sin dato de exposición' }],
  without_owner: [{ ci_id: 'CI-3', name: 'srv-web-03', detail: 'Sin dueño asignado' }],
  without_custodian: [{ ci_id: 'CI-3', name: 'srv-web-03', detail: 'Sin equipo custodio' }],
  outside_delivery_model: [],
};

/** APP_CONFIG for the specs, with or without the iTop console. */
export function testConfig(itopBaseUrl: string | null = 'https://itop.example.test') {
  return {
    production: false,
    apiBaseUrl: 'http://127.0.0.1:8000',
    firebase: null,
    authEmulatorUrl: null,
    itopBaseUrl,
  };
}
