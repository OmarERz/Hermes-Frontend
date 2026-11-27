import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LucideSearch } from '@lucide/angular';
import { finalize } from 'rxjs';
import { ApiError, toApiError } from '../../core/api/api-error';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent } from '../../shared/async-state.component';
import { CpeCandidate, InventoryService, Mapping } from './inventory.service';
import { viewState } from './inventory-view';

/** The software to map: its product id (the `{software}` of the route), its name and its current CPE. */
export interface MappingTarget {
  id: string;
  name: string;
  cpe?: string | null;
}

/** `MappingInput.cpe` of the OpenAPI: a CPE 2.3 name with a vendor and a product (FRONTEND.md §4). */
const CPE_PATTERN =
  /^cpe:2\.3:[ao]:[A-Za-z0-9](?:[A-Za-z0-9._~+-]|\\[:._~+-]){0,199}:[A-Za-z0-9](?:[A-Za-z0-9._~+-]|\\[:._~+-]){0,199}(?::(?:[^:\\]|\\.)*)+$/;
const MAX_CPE = 512;
const MIN_QUERY = 2;
const MAX_QUERY = 100;
const INVALID_CPE =
  'El CPE no es válido: escribe cpe:2.3:a: o cpe:2.3:o: seguido del fabricante y el producto (letras, números y . _ ~ + -).';

/** What is wrong with a CPE the person typed, or null. */
export function cpeProblem(value: string): string | null {
  const cpe = value.trim();
  if (!cpe) return 'Elige un candidato o escribe un CPE.';
  if (cpe.length > MAX_CPE || !CPE_PATTERN.test(cpe)) return INVALID_CPE;
  return null;
}

/**
 * Maps one software product to a CPE (ESC-05, ESC-06), for analysts and admins: it searches candidates in NVD's
 * CPE dictionary and in what Hermes already holds (`GET /api/cpe/candidates`), lets the person pick one or type a
 * CPE, and saves it (`PUT /api/mappings/{software}`). Without a CPE a product never produces findings (ESC-07).
 */
@Component({
  selector: 'app-cpe-mapping-dialog',
  imports: [FormsModule, AsyncStateComponent, LucideSearch],
  templateUrl: './cpe-mapping-dialog.html',
  styleUrl: './cpe-mapping-dialog.css',
})
export class CpeMappingDialog implements OnInit {
  private readonly service = inject(InventoryService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly software = input.required<MappingTarget>();
  readonly saved = output<Mapping>();
  readonly cancelled = output<void>();

  readonly query = signal('');
  readonly cpe = signal('');
  readonly queryError = signal<string | null>(null);
  readonly candidates = new AsyncState<CpeCandidate[]>();
  readonly saving = signal(false);
  readonly submitted = signal(false);
  readonly error = signal<ApiError | null>(null);

  readonly candidateState = computed(() => {
    if (this.candidates.status() === 'idle') return null;
    return viewState(this.candidates, (this.candidates.value() ?? []).length === 0);
  });
  readonly cpeError = computed(() => {
    if (this.submitted()) {
      const problem = cpeProblem(this.cpe());
      if (problem) return problem;
    }
    const failure = this.error();
    return failure && 'body.cpe' in failure.fieldIssues() ? INVALID_CPE : null;
  });
  /** The API's message for anything that is not the CPE field (403, 404, network…). */
  readonly saveError = computed(() => {
    const failure = this.error();
    return failure && !('body.cpe' in failure.fieldIssues()) ? failure.message : null;
  });

  constructor() {
    afterNextRender(() => this.searchInput()?.nativeElement.focus());
    this.destroyRef.onDestroy(() => this.candidates.cancel());
  }

  ngOnInit(): void {
    const target = this.software();
    this.cpe.set(target.cpe ?? '');
    this.query.set(target.name.trim().slice(0, MAX_QUERY));
    if (this.query().length >= MIN_QUERY) this.search();
  }

  search(): void {
    const q = this.query().trim();
    if (q.length < MIN_QUERY) {
      this.queryError.set(`Escribe al menos ${MIN_QUERY} caracteres para buscar.`);
      return;
    }
    this.queryError.set(null);
    this.candidates.run(this.service.cpeCandidates(q.slice(0, MAX_QUERY)));
  }

  pick(candidate: CpeCandidate): void {
    this.cpe.set(candidate.cpe);
    this.error.set(null);
  }

  save(): void {
    this.submitted.set(true);
    const cpe = this.cpe().trim();
    if (this.saving() || cpeProblem(cpe)) return;
    this.saving.set(true);
    this.error.set(null);
    this.service
      .setMapping(this.software().id, cpe)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (mapping) => this.saved.emit(mapping),
        error: (error: unknown) => this.error.set(toApiError(error)),
      });
  }

  /** Match score of a candidate as a whole percent. */
  score(candidate: CpeCandidate): number {
    return Math.round(candidate.score * 100);
  }
}
