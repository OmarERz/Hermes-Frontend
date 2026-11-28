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
import { ColumnsToggle } from '../../shared/columns-toggle';
import { ItopLink } from '../../shared/itop-links';
import { KpiCard, kpiState } from '../../shared/kpi-card';
import { ScrollFade } from '../../shared/scroll-fade.directive';
import {
  CLASSIFICATION_LABELS,
  formatDateTime,
  formatShortDateTime,
  LEVEL_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
} from '../../shared/labels';
import {
  CATEGORY_LABELS,
  cpeParts,
  CRITICALITY_LABELS,
  exposureLabel,
  INSTALL_STATUS_LABELS,
  INSTALL_STATUS_TONES,
  InstallStatus,
  itopClassLabel,
  licenceValidity,
  plural,
  text,
  yesNo,
} from './inventory-labels';
import { AssetDetail, InstalledSoftware, InventoryService } from './inventory.service';
import { viewState } from './inventory-view';

/** One term of the «Datos de iTop» list. */
interface Fact {
  term: string;
  value: string;
}

/**
 * Detail of one CI (AS-2, D-088): its iTop data (class, CPU, RAM, OS, service, description, criticality, exposure,
 * classification, personal data, owner, custodian, last sync and iTop link) and its vulnerability groups, all from
 * `GET /api/assets/{ci_id}` (since F18.6 it carries the inventory fields of `GET /api/inventory/assets`, with the same
 * names and values), and its installed software with category, status, licence, CPE and findings
 * (`GET /api/inventory/assets/{ci_id}/software`). Read only: changes are made in iTop («Ver en iTop», «Editar en
 * iTop»).
 */
@Component({
  selector: 'app-asset-detail-page',
  imports: [
    RouterLink,
    BannerPagina,
    AsyncStateComponent,
    Chip,
    ColumnsToggle,
    ItopLink,
    KpiCard,
    ScrollFade,
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
  readonly formatShortDateTime = formatShortDateTime;
  /** «Todas las columnas» of the installed software: state, category, licence and description (N-4). */
  readonly allSoftwareColumns = signal(false);

  readonly ciId = signal('');
  readonly detail = new AsyncState<AssetDetail>();
  readonly software = new AsyncState<InstalledSoftware[]>();

  readonly detailState = computed(() => viewState(this.detail));
  readonly title = computed(() => {
    const value = this.detail.value();
    return value && this.detail.status() === 'ready' ? value.name : 'Detalle de activo';
  });
  /** The CI in the iTop console, as the API links it (empty without the iTop URL: the link is then built). */
  readonly itopUrl = computed(() => this.detail.value()?.itop_url ?? null);

  readonly facts = computed<Fact[]>(() => {
    const detail = this.detail.value();
    if (!detail) return [];
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
      { term: 'Sistema operativo', value: text(detail.os) },
      { term: 'Servicio', value: text(detail.service) },
      { term: 'Criticidad', value: CRITICALITY_LABELS[detail.criticality ?? 'unknown'] },
      { term: 'Exposición a internet', value: exposureLabel(detail.exposed) },
      { term: 'Clasificación', value: CLASSIFICATION_LABELS[detail.classification] },
      { term: 'Datos personales', value: yesNo(detail.personal_data) },
      { term: 'Responsable', value: detail.owner ?? 'Sin responsable' },
      { term: 'Custodio', value: detail.custodian ?? 'Sin custodio' },
      {
        term: 'Última sincronización con iTop',
        value: detail.synced_at ? formatDateTime(detail.synced_at) : '—',
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
      cpeParts: cpeParts(item.cpe),
    })),
  );
  readonly installationsLabel = computed(() =>
    plural(this.softwareRows().length, 'instalación', 'instalaciones'),
  );
  readonly groupsLabel = computed(() => plural(this.findings().length, 'grupo', 'grupos'));
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
      this.software.cancel();
    });
  }

  load(): void {
    const ciId = this.ciId();
    this.detail.run(this.service.asset(ciId));
    this.loadSoftware();
  }

  loadSoftware(): void {
    this.software.run(this.service.assetSoftware(this.ciId()));
  }
}
