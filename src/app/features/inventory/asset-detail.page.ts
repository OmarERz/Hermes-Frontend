import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideFlame,
  LucideLayers,
  LucideMonitor,
  LucideShieldAlert,
  LucideTriangleAlert,
} from '@lucide/angular';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent } from '../../shared/async-state.component';
import { Chip } from '../../shared/chip';
import { ItopLink } from '../../shared/itop-links';
import { KpiCard, kpiState } from '../../shared/kpi-card';
import {
  CLASSIFICATION_LABELS,
  formatDateTime,
  LEVEL_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
} from '../../shared/labels';
import {
  CATEGORY_LABELS,
  CRITICALITY_LABELS,
  exposureLabel,
  INSTALL_STATUS_LABELS,
  INSTALL_STATUS_TONES,
  InstallStatus,
  itopClassLabel,
  licenceValidity,
  text,
  yesNo,
} from './inventory-labels';
import {
  AssetDetail,
  InstalledSoftware,
  InventoryAsset,
  InventoryService,
} from './inventory.service';
import { viewState } from './inventory-view';

/** One term of the «Datos de iTop» list. */
interface Fact {
  term: string;
  value: string;
}

/**
 * Detail of one CI (AS-2, D-088): its iTop data (class, CPU, RAM, OS, service, description, criticality, exposure,
 * classification, owner and custodian), its installed software with category, status, licence, CPE and findings
 * (`GET /api/inventory/assets/{ci_id}/software`) and its vulnerability groups (`GET /api/assets/{ci_id}`). The
 * detail route lacks the inventory fields, so the CI's row of `GET /api/inventory/assets` completes it. Read only:
 * changes are made in iTop («Ver en iTop», «Editar en iTop»).
 */
@Component({
  selector: 'app-asset-detail-page',
  imports: [
    RouterLink,
    BannerPagina,
    AsyncStateComponent,
    Chip,
    ItopLink,
    KpiCard,
    LucideArrowLeft,
    LucideLayers,
    LucideShieldAlert,
  ],
  templateUrl: './asset-detail.page.html',
  styleUrls: ['./inventory-chips.css', './asset-detail.page.css'],
})
export class AssetDetailPage {
  private readonly service = inject(InventoryService);

  readonly bannerIcon = LucideMonitor;
  readonly levelLabels = LEVEL_LABELS;
  readonly statusLabels = STATUS_LABELS;
  readonly statusTones = STATUS_TONES;
  readonly stateTones = INSTALL_STATUS_TONES;
  /** Icons of the indicator cards. */
  readonly kpiIcons = {
    risk: LucideShieldAlert,
    findings: LucideTriangleAlert,
    kev: LucideFlame,
    software: LucideLayers,
  };
  readonly formatDateTime = formatDateTime;

  readonly ciId = signal('');
  readonly detail = new AsyncState<AssetDetail>();
  /** The CI's row of the inventory list (criticality, exposure, OS, service, sync, iTop link); null if absent. */
  readonly row = new AsyncState<InventoryAsset | null>();
  readonly software = new AsyncState<InstalledSoftware[]>();

  readonly detailState = computed(() => viewState(this.detail));
  readonly title = computed(() => {
    const value = this.detail.value();
    return value && this.detail.status() === 'ready' ? value.name : 'Detalle de activo';
  });
  private readonly inventoryRow = computed(() =>
    this.row.status() === 'ready' ? this.row.value() : null,
  );
  readonly itopUrl = computed(() => this.inventoryRow()?.itop_url ?? null);

  readonly facts = computed<Fact[]>(() => {
    const detail = this.detail.value();
    if (!detail) return [];
    const row = this.inventoryRow();
    const pending = this.row.status() === 'loading' ? 'Cargando…' : '—';
    return [
      { term: 'ID del CI', value: detail.ci_id },
      {
        term: 'Clase de iTop',
        value: detail.itop_class
          ? `${itopClassLabel(detail.itop_class)} · ${detail.itop_class}`
          : 'Sin dato',
      },
      { term: 'CPU', value: text(detail.cpu) },
      { term: 'RAM', value: text(detail.ram) },
      { term: 'Sistema operativo', value: row ? text(row.os) : pending },
      { term: 'Servicio', value: row ? text(row.service) : pending },
      { term: 'Criticidad', value: row ? CRITICALITY_LABELS[row.criticality] : pending },
      { term: 'Exposición a internet', value: row ? exposureLabel(row.exposed) : pending },
      { term: 'Clasificación', value: CLASSIFICATION_LABELS[detail.classification] },
      { term: 'Datos personales', value: row ? yesNo(row.personal_data) : pending },
      { term: 'Responsable', value: detail.owner ?? 'Sin responsable' },
      { term: 'Custodio', value: detail.custodian ?? 'Sin custodio' },
      {
        term: 'Última sincronización con iTop',
        value: row ? formatDateTime(row.synced_at) : pending,
      },
    ];
  });

  /** Vulnerability groups of the CI (open and fixed, each with this CI's score and status), most urgent first. */
  readonly findings = computed(() =>
    [...(this.detail.value()?.findings ?? [])].sort((a, b) => b.final - a.final),
  );
  /**
   * The open ones (not `fixed`): the backend computes the CI's risk from them when there are any (D-035), so the
   * risk card shows the level of the top open finding and, without open findings, no risk at all.
   */
  readonly openFindings = computed(() =>
    this.findings().filter((finding) => finding.status !== 'fixed'),
  );
  readonly kevCount = computed(
    () => this.openFindings().filter((finding) => finding.in_kev).length,
  );
  readonly worstLevel = computed(() => this.openFindings()[0]?.level ?? null);

  readonly softwareRows = computed(() =>
    (this.software.value() ?? []).map((item, index) => ({
      ...item,
      // One row per iTop installation: two of the same product and version on a CI are still two rows.
      key: `${index}-${item.software_id}-${item.version}`,
      categoryLabel: item.category ? CATEGORY_LABELS[item.category] : 'Sin dato',
      statusKey: (item.status ?? 'unknown') as InstallStatus,
      statusLabel: INSTALL_STATUS_LABELS[item.status ?? 'unknown'],
      validity: item.licence ? licenceValidity(item.licence) : null,
    })),
  );
  readonly softwareState = computed(() =>
    viewState(this.software, this.softwareRows().length === 0),
  );
  readonly softwareKpiState = computed(() => kpiState(this.software.status()));

  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        this.ciId.set(params.get('ciId') ?? '');
        this.load();
      });
    inject(DestroyRef).onDestroy(() => {
      this.detail.cancel();
      this.row.cancel();
      this.software.cancel();
    });
  }

  load(): void {
    const ciId = this.ciId();
    this.detail.run(this.service.asset(ciId));
    this.loadRow();
    this.loadSoftware();
  }

  loadRow(): void {
    this.row.run(this.service.findAsset(this.ciId()));
  }

  loadSoftware(): void {
    this.software.run(this.service.assetSoftware(this.ciId()));
  }
}
