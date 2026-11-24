import { Component, computed, DestroyRef, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LucidePlus } from '@lucide/angular';
import { finalize } from 'rxjs';
import { ApiError, toApiError } from '../../core/api/api-error';
import { KIND_LABELS, Source, SOURCE_KINDS, SourceKind } from './source-labels';
import { SourcesService } from './sources.service';

/** Limits of `SourceCreate` in the OpenAPI. */
const MAX_NAME = 200;
const MAX_URL = 2048;

/** What is wrong with the name, or null. */
export function nameProblem(value: string): string | null {
  const name = value.trim();
  if (!name) return 'Escribe un nombre para la fuente.';
  if (name.length > MAX_NAME) return `El nombre admite hasta ${MAX_NAME} caracteres.`;
  return null;
}

/** What is wrong with the address, or null: own feeds are HTTPS only (D-041); the API checks the host. */
export function urlProblem(value: string): string | null {
  const url = value.trim();
  if (!url.startsWith('https://')) return 'La dirección debe empezar con https://.';
  if (url.length > MAX_URL) return `La dirección admite hasta ${MAX_URL} caracteres.`;
  try {
    if (!new URL(url).hostname) return 'La dirección no es válida.';
  } catch {
    return 'La dirección no es válida.';
  }
  return null;
}

/**
 * Admin form to add an own feed (`POST /api/sources`, FRO-16): HTTPS only; it enters as N4 and inactive, and an
 * analyst or admin switches it on later. The API refuses private hosts and addresses with keys or tokens; its
 * message is shown as is.
 */
@Component({
  selector: 'app-add-source-form',
  imports: [FormsModule, LucidePlus],
  host: { class: 'feed-details add-source' },
  templateUrl: './add-source-form.html',
  styleUrl: './add-source-form.css',
})
export class AddSourceForm {
  private readonly service = inject(SourcesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly created = output<Source>();
  readonly cancelled = output<void>();

  readonly kinds = SOURCE_KINDS;
  readonly kindLabels = KIND_LABELS;

  readonly name = signal('');
  readonly url = signal('https://');
  readonly kind = signal<SourceKind>('rss');
  readonly saving = signal(false);
  readonly submitted = signal(false);
  readonly error = signal<ApiError | null>(null);

  readonly nameError = computed(() => (this.submitted() ? nameProblem(this.name()) : null));
  readonly urlError = computed(() => (this.submitted() ? urlProblem(this.url()) : null));
  /** Fields the API marked, from the `details` of its error. */
  private readonly serverIssues = computed(() => this.error()?.fieldIssues() ?? {});
  readonly nameInvalid = computed(() => !!this.nameError() || 'body.name' in this.serverIssues());
  readonly urlInvalid = computed(() => !!this.urlError() || 'body.url' in this.serverIssues());

  submit(): void {
    this.submitted.set(true);
    if (this.saving() || nameProblem(this.name()) || urlProblem(this.url())) return;
    this.saving.set(true);
    this.error.set(null);
    this.service
      .create({ name: this.name().trim(), url: this.url().trim(), kind: this.kind() })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (source) => this.created.emit(source),
        error: (error: unknown) => this.error.set(toApiError(error)),
      });
  }
}
