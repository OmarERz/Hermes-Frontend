import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LucideDownload } from '@lucide/angular';
import { BannerPagina } from '../../componentes/banner-pagina/banner-pagina';
import { ApiError, toApiError } from '../../core/api/api-error';
import { AsyncState } from '../../shared/async-state';
import { formatDateTime } from '../../shared/labels';
import { LoadMoreList } from './load-more-list';
import { Run, StixBundle, StixExportRequest, StixService } from './stix.service';
import {
  VulnerabilitiesService,
  VulnerabilityDetail,
  VulnerabilityGroup,
} from './vulnerabilities.service';
import { RUN_KIND_LABELS } from './vulnerability-texts';

export type StixScope = StixExportRequest['scope'];

const SCOPE_LABELS: Record<StixScope, string> = {
  vulnerability: 'Una vulnerabilidad',
  run: 'Una corrida',
  date_range: 'Un rango de fechas',
};

/** Groups and runs per page of the pickers (the API maximum); «Cargar más» reaches the rest. */
const PICKER_PAGE = 200;

/**
 * Exportación STIX (FRO-20, role analyst): a STIX 2.1 bundle of one vulnerability, one run or a date range,
 * downloaded as a JSON file. Highly classified assets are left out by default (the backend applies the TLP).
 */
@Component({
  selector: 'app-stix-export-page',
  imports: [FormsModule, BannerPagina, LucideDownload],
  templateUrl: './stix-export.page.html',
  styleUrl: './stix-export.page.css',
})
export class StixExportPage {
  private readonly stix = inject(StixService);
  private readonly vulnerabilities = inject(VulnerabilitiesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly bannerIcon = LucideDownload;
  readonly scopes = Object.keys(SCOPE_LABELS) as StixScope[];
  readonly scopeLabels = SCOPE_LABELS;

  readonly scope = signal<StixScope>('vulnerability');
  readonly groupId = signal('');
  readonly runId = signal('');
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly excludeHighlyClassified = signal(true);

  readonly groups = new LoadMoreList<VulnerabilityGroup>((cursor) =>
    this.vulnerabilities.listGroups({}, cursor, PICKER_PAGE),
  );
  readonly runs = new LoadMoreList<Run>((cursor) => this.stix.listRuns(cursor, PICKER_PAGE));
  /** The group of `?grupo=`, which may be on a page the picker has not loaded yet. */
  private readonly presetId = inject(ActivatedRoute).snapshot.queryParamMap.get('grupo');
  readonly preset = new AsyncState<VulnerabilityDetail>();

  readonly exporting = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly result = signal<string>('');

  /** Groups of the loaded pages, with the group of the link first when it is not among them. */
  readonly groupOptions = computed(() => {
    const options = this.groups.items().map((group) => ({
      id: group.group_id,
      label: `${group.cve} · ${group.product}`,
    }));
    const presetId = this.presetId;
    if (presetId && !options.some((option) => option.id === presetId)) {
      const detail = this.preset.value();
      const label = detail ? `${detail.cve} · ${detail.product}` : 'La vulnerabilidad del enlace';
      options.unshift({ id: presetId, label });
    }
    return options;
  });

  readonly runOptions = computed(() =>
    this.runs.items().map((run) => ({
      id: run.id,
      label: `${RUN_KIND_LABELS[run.kind]} · ${formatDateTime(run.started_at)} · ${run.status}`,
    })),
  );

  /** What is missing or wrong in the form, in Spanish; empty when it can be sent. */
  readonly problem = computed(() => {
    switch (this.scope()) {
      case 'vulnerability':
        return this.groupId() ? '' : 'Elige la vulnerabilidad que quieres exportar.';
      case 'run':
        return this.runId() ? '' : 'Elige la corrida que quieres exportar.';
      default:
        if (!this.dateFrom() || !this.dateTo()) return 'Indica la fecha inicial y la final.';
        return this.dateFrom() > this.dateTo()
          ? 'La fecha inicial no puede ser posterior a la final.'
          : '';
    }
  });

  constructor() {
    if (this.presetId) {
      this.groupId.set(this.presetId);
      this.preset.run(this.vulnerabilities.getDetail(this.presetId));
    }
    this.groups.first();
    this.runs.first();
    this.destroyRef.onDestroy(() => {
      this.groups.cancel();
      this.runs.cancel();
      this.preset.cancel();
    });
  }

  setScope(scope: StixScope): void {
    this.scope.set(scope);
    this.result.set('');
    this.error.set(null);
  }

  /**
   * The request of the current form (only the fields of its scope). The range goes as two days without time: the
   * backend takes them as whole UTC days, from the first day's midnight up to (not including) the midnight after
   * the last day, so nothing changed in the last second is left out.
   */
  request(): StixExportRequest {
    const base = { exclude_ultra_classified: this.excludeHighlyClassified() };
    switch (this.scope()) {
      case 'vulnerability':
        return { ...base, scope: 'vulnerability', vulnerability_id: this.groupId() };
      case 'run':
        return { ...base, scope: 'run', run_id: this.runId() };
      default:
        return {
          ...base,
          scope: 'date_range',
          date_from: this.dateFrom(),
          date_to: this.dateTo(),
        };
    }
  }

  export(): void {
    if (this.problem() || this.exporting()) return;
    this.exporting.set(true);
    this.error.set(null);
    this.result.set('');
    const request = this.request();
    // A late answer after leaving the screen (or signing out) must not start a download.
    this.stix
      .exportBundle(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (bundle: StixBundle) => {
          this.stix.download(bundle, `hermes-stix-${request.scope}-${fileStamp(new Date())}.json`);
          this.result.set(
            `Bundle descargado con ${bundle.objects.length} ${bundle.objects.length === 1 ? 'objeto' : 'objetos'}.`,
          );
          this.exporting.set(false);
        },
        error: (failure: unknown) => {
          this.error.set(toApiError(failure));
          this.exporting.set(false);
        },
      });
  }
}

/** 20261124-0730 in local time, for the file name. */
function fileStamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}
