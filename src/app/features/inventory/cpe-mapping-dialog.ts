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
import { CnaNames, CpeCandidate, InventoryService, Mapping } from './inventory.service';
import { cnaLabel } from './inventory-labels';
import { viewState } from './inventory-view';

/**
 * The software to map: its product id (the `{software}` of the route), its name, its current CPE and the CNA names
 * of its mapping (F15.9; unknown where the screen does not have them, as in Pendientes).
 */
export interface MappingTarget {
  id: string;
  name: string;
  cpe?: string | null;
  cna?: CnaNames | null;
}

/**
 * `MappingInput.cpe` of the OpenAPI: a CPE 2.3 name of an application, an operating system or hardware, with a vendor
 * and a product (FRONTEND.md §4, F15.9).
 */
const CPE_PATTERN =
  /^cpe:2\.3:[aoh]:[A-Za-z0-9](?:[A-Za-z0-9._~+-]|\\[:._~+-]){0,199}:[A-Za-z0-9](?:[A-Za-z0-9._~+-]|\\[:._~+-]){0,199}(?::(?:[^:\\]|\\.)*)+$/;
const MAX_CPE = 512;
const MIN_QUERY = 2;
const MAX_QUERY = 100;
const INVALID_CPE =
  'El CPE no es válido: escribe cpe:2.3:a:, cpe:2.3:o: o cpe:2.3:h: seguido del fabricante y el producto (letras, números y . _ ~ + -).';
/** `CnaNames` of the OpenAPI: each name 1 to 200 characters, something visible and no control characters. */
const MAX_CNA = 200;
const INVALID_CNA =
  'El nombre no es válido: de 1 a 200 caracteres, sin saltos de línea ni caracteres de control.';
/** The CNA fields of the form, and the API field of each (`body.cna.vendor`, `body.cna.product`). */
export type CnaField = keyof CnaNames;
const CNA_FIELDS: readonly CnaField[] = ['vendor', 'product'];
const MISSING_CNA: Record<CnaField, string> = {
  vendor: 'Escribe también el fabricante, o deja vacíos los dos nombres.',
  product: 'Escribe también el producto, o deja vacíos los dos nombres.',
};

/** What is wrong with a CPE the person typed, or null. */
export function cpeProblem(value: string): string | null {
  const cpe = value.trim();
  if (!cpe) return 'Elige un candidato o escribe un CPE.';
  if (cpe.length > MAX_CPE || !CPE_PATTERN.test(cpe)) return INVALID_CPE;
  return null;
}

/** A C0 or C1 control character (U+0000–U+001F, U+007F–U+009F), which the API refuses in a CNA name. */
function hasControl(value: string): boolean {
  return [...value].some((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
  });
}

/**
 * What is wrong with the CNA names the person typed, per field, as the API checks them (trimmed): both empty is fine
 * (the names are optional); otherwise both are needed, each with 200 characters or fewer (counted as the API counts
 * them, by code point) and no control characters.
 */
export function cnaProblems(vendor: string, product: string): Partial<Record<CnaField, string>> {
  const values: CnaNames = { vendor: vendor.trim(), product: product.trim() };
  if (!values.vendor && !values.product) return {};
  const problems: Partial<Record<CnaField, string>> = {};
  for (const field of CNA_FIELDS) {
    const value = values[field];
    if (!value) problems[field] = MISSING_CNA[field];
    else if ([...value].length > MAX_CNA || hasControl(value)) problems[field] = INVALID_CNA;
  }
  return problems;
}

/** The fields of the form the API can point at (`details[].field`): each one shows its own text. */
function ownFieldIssue(issues: Record<string, string>): boolean {
  return ['body.cpe', ...CNA_FIELDS.map((field) => `body.cna.${field}`)].some(
    (field) => field in issues,
  );
}

/** The notice of a saved mapping, with its CNA names when it has them. */
export function mappingNotice(name: string, mapping: Mapping): string {
  const names = mapping.cna ? ` y los nombres de CVE.org ${cnaLabel(mapping.cna)}` : '';
  return `CPE guardado para ${name} (${mapping.cpe})${names}. Hermes buscará sus vulnerabilidades en el siguiente escaneo.`;
}

/**
 * Maps one software product to a CPE (ESC-05, ESC-06), for analysts and admins: it searches candidates in NVD's
 * CPE dictionary and in what Hermes already holds (`GET /api/cpe/candidates`), lets the person pick one or type a
 * CPE, and saves it (`PUT /api/mappings/{software}`). Without a CPE a product never produces findings (ESC-07).
 * Optionally it also takes the vendor and product names the CNA uses in CVE.org (F15.9): without them the scan does not
 * check that source (certainty 0.9) for the product. Empty names are left out of the request (the API keeps what the
 * mapping has), unless the mapping had names, which the person then removes (`cna: null`).
 * A native modal `<dialog>` (as the feedback dialog): the page behind is inert, Tab stays inside and closing gives
 * the focus back to the button that opened it. Every way out (Cancelar, Escape, the browser closing it) waits for a
 * save in flight, so the page always learns whether the mapping was saved.
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
  private readonly dialogElement =
    viewChild.required<ElementRef<HTMLDialogElement>>('dialogElement');
  /** Set once the dialog emitted its outcome (saved or cancelled). */
  private done = false;

  readonly software = input.required<MappingTarget>();
  readonly saved = output<Mapping>();
  readonly cancelled = output<void>();

  readonly query = signal('');
  readonly cpe = signal('');
  readonly cnaVendor = signal('');
  readonly cnaProduct = signal('');
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
  /** The problem of each CNA name: what the form finds after a save, or what the API refused. */
  readonly cnaErrors = computed<Record<CnaField, string | null>>(() => {
    const own = this.submitted() ? cnaProblems(this.cnaVendor(), this.cnaProduct()) : {};
    const issues = this.error()?.fieldIssues() ?? {};
    const problem = (field: CnaField): string | null =>
      own[field] ?? (`body.cna.${field}` in issues ? INVALID_CNA : null);
    return { vendor: problem('vendor'), product: problem('product') };
  });
  /** The API's message for anything that is not a field of the form (403, 404, network…). */
  readonly saveError = computed(() => {
    const failure = this.error();
    return failure && !ownFieldIssue(failure.fieldIssues()) ? failure.message : null;
  });

  constructor() {
    afterNextRender(() => {
      this.show();
      this.searchInput()?.nativeElement.focus();
    });
    this.destroyRef.onDestroy(() => this.candidates.cancel());
  }

  ngOnInit(): void {
    const target = this.software();
    this.cpe.set(target.cpe ?? '');
    this.cnaVendor.set(target.cna?.vendor ?? '');
    this.cnaProduct.set(target.cna?.product ?? '');
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
    const cnaInvalid = Object.keys(cnaProblems(this.cnaVendor(), this.cnaProduct())).length > 0;
    if (this.saving() || cpeProblem(cpe) || cnaInvalid) return;
    this.saving.set(true);
    this.error.set(null);
    this.service
      .setMapping(this.software().id, cpe, this.cnaToSend())
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (mapping) => this.finish(() => this.saved.emit(mapping)),
        error: (error: unknown) => this.error.set(toApiError(error)),
      });
  }

  /**
   * The `cna` of the request: both names (trimmed) when given; with both empty, `null` to remove the names the mapping
   * had, or nothing at all (the API keeps whatever it holds, which this screen may not know).
   */
  private cnaToSend(): CnaNames | null | undefined {
    const vendor = this.cnaVendor().trim();
    const product = this.cnaProduct().trim();
    if (vendor && product) return { vendor, product };
    return this.software().cna ? null : undefined;
  }

  /** Cancelar or Escape: never while a save runs. */
  close(): void {
    if (this.saving()) return;
    this.finish(() => this.cancelled.emit());
  }

  /** Escape asks to close through the same rule. */
  onCancel(event: Event): void {
    event.preventDefault();
    this.close();
  }

  /**
   * The browser closed the modal on its own (it may skip the cancelable `cancel` event, for example on a second
   * Escape): it opens again while a save runs, and otherwise counts as a cancel.
   */
  onNativeClose(): void {
    if (this.done) return;
    if (this.saving()) {
      this.show();
      return;
    }
    this.finish(() => this.cancelled.emit());
  }

  private show(): void {
    const dialog = this.dialogElement().nativeElement;
    if (dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  /** Closes the native dialog (which gives the focus back to the opener) and emits the outcome once. */
  private finish(emit: () => void): void {
    if (this.done) return;
    this.done = true;
    const dialog = this.dialogElement().nativeElement;
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    emit();
  }

  /** Match score of a candidate as a whole percent. */
  score(candidate: CpeCandidate): number {
    return Math.round(candidate.score * 100);
  }
}
