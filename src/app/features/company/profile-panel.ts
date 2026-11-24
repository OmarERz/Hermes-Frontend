import { Component, computed, DestroyRef, inject, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LucideBuilding2, LucidePencil, LucideX } from '@lucide/angular';
import { finalize, tap } from 'rxjs';
import { ApiError, toApiError } from '../../core/api/api-error';
import { IfRoleDirective } from '../../core/auth/if-role.directive';
import { ACTION_ROLES } from '../../core/auth/roles';
import { AsyncState } from '../../shared/async-state';
import { AsyncStateComponent } from '../../shared/async-state.component';
import { ConfirmChangesDialog } from '../../shared/confirm-changes-dialog';
import { ChangeRow, withExpectedVersion } from '../../shared/versioned-save';
import {
  CompanyProfile,
  COUNTRY_PATTERN,
  countryList,
  countryName,
  LANGUAGE_CODES,
  languageName,
  SECTOR_CODES,
  sectorList,
  sectorName,
} from './company-labels';
import { CompanyService } from './company.service';

/** The editable part of the profile (everything but its version). */
export type ProfileDraft = Omit<CompanyProfile, 'version'>;

/** API limit of `ProfileUpdate.countries`. */
const MAX_COUNTRIES = 300;

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n');
}

/** Before/after rows of the fields that change, for the confirmation dialog. */
export function profileChanges(before: ProfileDraft, after: ProfileDraft): ChangeRow[] {
  const rows: ChangeRow[] = [];
  if (before.sector !== after.sector)
    rows.push({
      name: 'Sector principal',
      before: sectorName(before.sector),
      after: sectorName(after.sector),
    });
  if (!sameList(before.subsectors, after.subsectors))
    rows.push({
      name: 'Subsectores',
      before: sectorList(before.subsectors),
      after: sectorList(after.subsectors),
    });
  if (!sameList(before.countries, after.countries))
    rows.push({
      name: 'Países de operación',
      before: countryList(before.countries),
      after: countryList(after.countries),
    });
  if (before.language !== after.language)
    rows.push({
      name: 'Idioma de salida',
      before: languageName(before.language),
      after: languageName(after.language),
    });
  return rows;
}

/**
 * Perfil de la empresa (docs/13 §9 paso 2): sector, subsectors, countries and output language. Every role reads it;
 * an admin edits it and confirms the before/after, and the save carries the version read (`expected_version`): a
 * 409 `version_conflict` offers to reload instead of overwriting someone else's change.
 */
@Component({
  selector: 'app-profile-panel',
  imports: [
    FormsModule,
    AsyncStateComponent,
    ConfirmChangesDialog,
    IfRoleDirective,
    LucideBuilding2,
    LucidePencil,
    LucideX,
  ],
  templateUrl: './profile-panel.html',
  styleUrl: './company-forms.css',
})
export class ProfilePanel implements OnInit {
  private readonly service = inject(CompanyService);
  private readonly destroyRef = inject(DestroyRef);

  /** The profile each time it is read or saved (the page shows its summary). */
  readonly profileChange = output<CompanyProfile>();

  readonly editRole = ACTION_ROLES.editProfile;
  readonly sectorName = sectorName;
  readonly countryName = countryName;
  readonly languageName = languageName;
  readonly sectorList = sectorList;
  readonly countryList = countryList;

  readonly load = new AsyncState<CompanyProfile>();
  readonly profile = signal<CompanyProfile | null>(null);
  readonly notice = signal<string | null>(null);

  readonly editing = signal(false);
  readonly sector = signal('');
  readonly subsectors = signal<string[]>([]);
  readonly countries = signal<string[]>([]);
  readonly language = signal('es');
  readonly countryInput = signal('');
  readonly countryError = signal<string | null>(null);
  readonly submitted = signal(false);
  readonly formNote = signal<string | null>(null);

  readonly confirming = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<ApiError | null>(null);

  readonly draft = computed<ProfileDraft>(() => ({
    sector: this.sector(),
    subsectors: [...this.subsectors()].sort(),
    countries: [...this.countries()].sort(),
    language: this.language(),
  }));
  readonly changes = computed(() => {
    const current = this.profile();
    return current ? profileChanges(current, this.draft()) : [];
  });
  readonly sectorError = computed(() =>
    this.submitted() && !this.sector() ? 'Elige el sector principal.' : null,
  );

  /** Catalog codes, plus any saved code the catalog does not list (so it is never dropped silently). */
  readonly sectorOptions = computed(() => {
    const saved = this.profile();
    const extra = saved ? [saved.sector, ...saved.subsectors].filter(Boolean) : [];
    return [...new Set([...SECTOR_CODES, ...extra])];
  });
  readonly subsectorOptions = computed(() =>
    this.sectorOptions().filter((code) => code !== this.sector()),
  );
  readonly languageOptions = computed(() => [
    ...new Set([...LANGUAGE_CODES, this.profile()?.language ?? 'es']),
  ]);

  constructor() {
    this.destroyRef.onDestroy(() => this.load.cancel());
  }

  /** Loads on init, not in the constructor: the page listens to `profileChange` only once the panel exists. */
  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.load.run(
      this.service.getProfile().pipe(
        tap((profile) => {
          this.profile.set(profile);
          this.profileChange.emit(profile);
        }),
      ),
    );
  }

  /** Starts from the profile just read; never while a reload is running or failed (its draft would be stale). */
  startEdit(): void {
    const current = this.profile();
    if (!current || this.load.status() !== 'ready') return;
    this.sector.set(current.sector);
    this.subsectors.set([...current.subsectors]);
    this.countries.set([...current.countries]);
    this.language.set(current.language);
    this.countryInput.set('');
    this.countryError.set(null);
    this.submitted.set(false);
    this.formNote.set(null);
    this.notice.set(null);
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  /** A new primary sector cannot also be a subsector (the API refuses repeated sectors). */
  setSector(code: string): void {
    this.sector.set(code);
    this.subsectors.update((codes) => codes.filter((item) => item !== code));
  }

  toggleSubsector(code: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.subsectors.update((codes) =>
      checked ? [...new Set([...codes, code])] : codes.filter((item) => item !== code),
    );
  }

  addCountry(event?: Event): void {
    event?.preventDefault();
    const code = this.countryInput().trim().toUpperCase();
    if (!COUNTRY_PATTERN.test(code)) {
      this.countryError.set('Escribe el código ISO de dos letras del país (por ejemplo, MX).');
      return;
    }
    if (this.countries().includes(code)) {
      this.countryError.set(`${countryName(code)} ya está en la lista.`);
      return;
    }
    if (this.countries().length >= MAX_COUNTRIES) {
      this.countryError.set(`El perfil admite hasta ${MAX_COUNTRIES} países.`);
      return;
    }
    this.countries.update((codes) => [...codes, code]);
    this.countryInput.set('');
    this.countryError.set(null);
  }

  removeCountry(code: string): void {
    this.countries.update((codes) => codes.filter((item) => item !== code));
  }

  /** Checks the form and opens the before/after confirmation. */
  review(): void {
    this.submitted.set(true);
    this.formNote.set(null);
    if (this.sectorError()) return;
    if (!this.changes().length) {
      this.formNote.set('No hay cambios que guardar.');
      return;
    }
    this.saveError.set(null);
    this.confirming.set(true);
  }

  save(): void {
    const current = this.profile();
    if (!current || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.service
      .updateProfile(withExpectedVersion(this.draft(), current.version))
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved) => {
          this.profile.set(saved);
          this.profileChange.emit(saved);
          this.confirming.set(false);
          this.editing.set(false);
          this.notice.set('Perfil guardado.');
        },
        error: (error: unknown) => this.saveError.set(toApiError(error)),
      });
  }

  closeConfirm(): void {
    if (this.saving()) return;
    this.confirming.set(false);
  }

  /** After a 409: drop the edit and read the current version. */
  reloadAfterConflict(): void {
    this.confirming.set(false);
    this.editing.set(false);
    this.saveError.set(null);
    this.notice.set('Se cargó la versión actual del perfil. Vuelve a aplicar tus cambios.');
    this.reload();
  }
}
