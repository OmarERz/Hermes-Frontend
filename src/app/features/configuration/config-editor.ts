import { computed, DestroyRef, inject, signal } from '@angular/core';
import { Subscription, tap } from 'rxjs';
import { ApiError, ApiErrorDetail, toApiError } from '../../core/api/api-error';
import { SessionService } from '../../core/auth/session.service';
import { AsyncState } from '../../shared/async-state';
import type { ChangeRow } from '../../shared/versioned-save';
import { ConfigApi } from './config-api';
import {
  checkValue,
  ConfigChanges,
  ConfigParameter,
  displayValue,
  issueMessage,
  lowestRole,
  sameValue,
  SimulationOutcome,
  splitIssues,
  WEIGHTS_RULE,
  weightsSumToOne,
  weightsTotal,
} from './config-model';
import { ConfigStore } from './config-store';

export interface ConfigEditorOptions {
  /** The parameters this screen edits (by group or key, always from the schema). */
  include: (param: ConfigParameter) => boolean;
  /** True when saving needs a simulation of the exact draft first (formula and judge, FRO-04/FRO-06). */
  simulate: boolean;
  /** Name of a parameter for people; the schema description by default. */
  label?: (param: ConfigParameter) => string;
}

const SAVED_FORMULA =
  ' Se encoló el recálculo de las puntuaciones base, sin llamar al juez (aparece en Corridas).';

/**
 * Draft, validation, simulation and versioned save of the parameters of one screen, generated from
 * `GET /api/config/schema` (API-05): a parameter the API adds appears without changing the front. Values are
 * text, as the API takes them. Saving sends only what changed, with the version the screen read
 * (`expected_version`, API-03); a 409 offers to reload instead of overwriting.
 */
export class ConfigEditor {
  private readonly store: ConfigStore;
  private readonly api = inject(ConfigApi);
  private readonly session = inject(SessionService);
  private saveSubscription: Subscription | null = null;

  readonly draft = signal<ConfigChanges>({});
  readonly simulation = new AsyncState<SimulationOutcome>();
  private readonly simulatedFor = signal<string | null>(null);
  readonly confirming = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<ApiError | null>(null);
  /** Result of the last action for the person (saved version, reload after a conflict, refused change). */
  readonly notice = signal('');
  private readonly apiIssues = signal<readonly ApiErrorDetail[]>([]);

  readonly parameters = computed(() =>
    this.store.parameters().filter((param) => this.options.include(param)),
  );
  private readonly byKey = computed(() => new Map(this.parameters().map((p) => [p.key, p])));

  /** The role that can save at least one parameter of the screen (shows the save actions). */
  readonly saveRole = computed(() =>
    lowestRole(
      this.parameters()
        .filter((p) => p.level !== 'blocked')
        .map((p) => p.min_role),
    ),
  );

  /** Only the drafted values that differ from the current ones. */
  readonly changes = computed<ConfigChanges>(() => {
    const changes: ConfigChanges = {};
    for (const [key, raw] of Object.entries(this.draft())) {
      const param = this.byKey().get(key);
      if (!param) continue;
      const current = this.current(key);
      if (current === undefined || !sameValue(param, raw, current)) changes[key] = raw;
    }
    return changes;
  });
  readonly changeCount = computed(() => Object.keys(this.changes()).length);

  readonly weightsTotal = computed(() => weightsTotal(this.parameters(), (key) => this.value(key)));

  private readonly issues = computed(() => splitIssues(this.apiIssues()));

  /** Message per parameter: the client checks of the draft, then what the API answered. */
  readonly fieldErrors = computed<Record<string, string>>(() => {
    const errors: Record<string, string> = {};
    for (const [key, issue] of Object.entries(this.issues().byKey)) {
      errors[key] = issueMessage(issue, this.byKey().get(key));
    }
    for (const [key, raw] of Object.entries(this.draft())) {
      const param = this.byKey().get(key);
      const issue = param ? checkValue(param, raw) : null;
      if (param && issue) errors[key] = issueMessage(issue, param);
    }
    return errors;
  });

  /** Rules of the whole change (weights that do not sum 1.0, levels out of order…). */
  readonly ruleErrors = computed<string[]>(() => {
    const rules = new Set(this.issues().rules.map((issue) => issueMessage(issue)));
    if (!weightsSumToOne(this.weightsTotal())) rules.add(issueMessage(WEIGHTS_RULE));
    return [...rules];
  });

  /** True when the draft passes the client checks (the API repeats them all). */
  readonly valid = computed(
    () =>
      Object.entries(this.draft()).every(([key, raw]) => {
        const param = this.byKey().get(key);
        return !param || checkValue(param, raw) === null;
      }) && weightsSumToOne(this.weightsTotal()),
  );

  private readonly fingerprint = computed(() =>
    JSON.stringify(Object.entries(this.changes()).sort(([a], [b]) => a.localeCompare(b))),
  );
  /** The simulation shown is the one of the exact current draft. */
  readonly simulationFresh = computed(
    () => this.simulation.status() === 'ready' && this.simulatedFor() === this.fingerprint(),
  );
  readonly simulationStale = computed(
    () => this.simulation.status() === 'ready' && !this.simulationFresh(),
  );

  readonly canSimulate = computed(
    () =>
      this.options.simulate &&
      this.changeCount() > 0 &&
      this.valid() &&
      !this.simulation.loading() &&
      this.store.version() !== null,
  );
  readonly canSave = computed(
    () =>
      this.changeCount() > 0 &&
      this.valid() &&
      !this.saving() &&
      this.store.version() !== null &&
      (!this.options.simulate || this.simulationFresh()),
  );

  /** Before/after rows of the confirmation, with the simulated effect first. */
  readonly changeRows = computed<ChangeRow[]>(() => {
    const outcome = this.simulationFresh() ? this.simulation.value() : null;
    const noPreview = new Set(outcome?.notSimulable ?? []);
    const rows: ChangeRow[] = [];
    if (outcome?.result) {
      rows.push({
        name: 'Efecto simulado en los hallazgos abiertos',
        before: 'Nivel actual',
        after: `${outcome.result.changed_findings} cambian de nivel`,
        impact: outcome.result.last_30_days_effect,
      });
    }
    const names = new Set<string>();
    for (const [key, raw] of Object.entries(this.changes())) {
      const param = this.byKey().get(key);
      if (!param) continue;
      let name = this.label(param);
      if (names.has(name)) name = `${name} (${key})`;
      names.add(name);
      rows.push({
        name,
        before: displayValue(param, this.current(key)),
        after: displayValue(param, raw),
        impact: noPreview.has(key)
          ? 'Sin vista previa: este cambio no se puede simular.'
          : undefined,
      });
    }
    return rows;
  });

  constructor(
    private readonly options: ConfigEditorOptions,
    store?: ConfigStore,
  ) {
    this.store = store ?? inject(ConfigStore);
    inject(DestroyRef).onDestroy(() => {
      this.simulation.cancel();
      this.saveSubscription?.unsubscribe();
    });
  }

  /** True when this screen simulates before saving. */
  get simulates(): boolean {
    return this.options.simulate;
  }

  label(param: ConfigParameter): string {
    return this.options.label?.(param) ?? param.description;
  }

  /** The current value (null-safe: a parameter without a stored value uses its default). */
  current(key: string): string | undefined {
    return this.store.values()[key] ?? this.byKey().get(key)?.default;
  }

  value(key: string): string {
    return this.draft()[key] ?? this.current(key) ?? '';
  }

  isChanged(key: string): boolean {
    return key in this.changes();
  }

  /** A person edits a parameter only when the role reaches its `min_role` and it is not blocked (🔒). */
  canEdit(param: ConfigParameter): boolean {
    return param.level !== 'blocked' && this.session.hasRole(param.min_role);
  }

  set(key: string, raw: string): void {
    const param = this.byKey().get(key);
    if (!param || !this.canEdit(param)) return;
    this.draft.update((draft) => ({ ...draft, [key]: raw }));
    this.apiIssues.set([]);
    this.notice.set('');
  }

  simulate(): void {
    if (!this.canSimulate()) return;
    const formulaKeys = new Set(
      this.store
        .parameters()
        .filter((param) => param.group === 'formula')
        .map((param) => param.key),
    );
    this.apiIssues.set([]);
    this.notice.set('');
    this.simulatedFor.set(this.fingerprint());
    this.simulation.run(
      this.api
        .simulate(this.changes(), formulaKeys)
        .pipe(tap({ error: (error: unknown) => this.apiIssues.set(toApiError(error).details) })),
    );
  }

  openConfirm(): void {
    if (!this.canSave()) return;
    this.saveError.set(null);
    this.confirming.set(true);
  }

  cancelConfirm(): void {
    if (this.saving()) return;
    this.confirming.set(false);
    this.saveError.set(null);
  }

  confirm(): void {
    const version = this.store.version();
    if (version === null || this.saving() || !this.canSave()) return;
    const changes = this.changes();
    const formula = Object.keys(changes).some((key) => this.byKey().get(key)?.group === 'formula');
    this.saving.set(true);
    this.saveError.set(null);
    this.saveSubscription = this.api.update(changes, version).subscribe({
      next: (document) => {
        this.saving.set(false);
        this.confirming.set(false);
        this.store.accept(document);
        this.resetDraft();
        this.notice.set(
          document.version === version
            ? 'No había cambios que guardar.'
            : `Se guardó la versión ${document.version} de la configuración.` +
                (formula ? SAVED_FORMULA : ''),
        );
      },
      error: (error: unknown) => {
        const failure = toApiError(error);
        this.saving.set(false);
        if (failure.status === 422 || (failure.status === 403 && failure.details.length)) {
          // The refused values are marked on the form, where they can be fixed.
          this.confirming.set(false);
          this.apiIssues.set(failure.details);
          this.notice.set(failure.message);
          return;
        }
        this.saveError.set(failure);
      },
    });
  }

  /** After a 409 `version_conflict`: drop the draft and read the current version. */
  reloadAfterConflict(): void {
    this.confirming.set(false);
    this.saveError.set(null);
    this.resetDraft();
    this.store.load();
    this.notice.set('Se cargó la configuración vigente. Vuelve a aplicar tus cambios.');
  }

  discard(): void {
    this.resetDraft();
    this.notice.set('');
  }

  private resetDraft(): void {
    this.draft.set({});
    this.apiIssues.set([]);
    this.simulation.cancel();
    this.simulation.status.set('idle');
    this.simulation.value.set(null);
    this.simulation.error.set(null);
    this.simulatedFor.set(null);
  }
}
