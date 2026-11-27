import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  LucideChevronLeft,
  LucideChevronRight,
  LucidePencil,
  LucidePlus,
  LucideTrash2,
  LucideUsers,
  LucideX,
} from '@lucide/angular';
import { finalize, Observable } from 'rxjs';
import { ApiError, toApiError } from '../../core/api/api-error';
import type { Role } from '../../core/api/api-types';
import { IfRoleDirective } from '../../core/auth/if-role.directive';
import { AsyncStateComponent } from '../../shared/async-state.component';
import { CursorPager } from '../../shared/cursor-pager';
import {
  COUNTRY_PATTERN,
  countryName,
  PeerCompany,
  PeerCompanyInput,
  SECTOR_CODES,
  sectorName,
} from './company-labels';
import { CompanyService } from './company.service';

/** Peers per page (the API serves up to 200). */
export const PEER_PAGE_SIZE = 50;

/** Limits of `PeerCompanyInput` in the OpenAPI. */
const MAX_NAME = 200;
const MAX_ALIASES = 50;
const MAX_DOMAIN = 253;

/** The form fields that can carry a problem (the `body.<field>` of the API details). */
export type PeerField = 'name' | 'aliases' | 'domain' | 'sector' | 'country';

/** What is wrong with each field of a peer before it is sent (the API repeats every rule). */
export function peerProblems(peer: PeerCompanyInput): Partial<Record<PeerField, string>> {
  const problems: Partial<Record<PeerField, string>> = {};
  const name = peer.name.trim();
  if (!name) problems.name = 'Escribe el nombre de la empresa.';
  else if (name.length > MAX_NAME) problems.name = `El nombre admite hasta ${MAX_NAME} caracteres.`;
  const domain = peer.domain ?? '';
  if (domain.length > MAX_DOMAIN)
    problems.domain = `El dominio admite hasta ${MAX_DOMAIN} caracteres.`;
  else if (/[\s/]/.test(domain))
    problems.domain =
      'Escribe solo el dominio, sin https:// ni rutas (por ejemplo, pagos.example).';
  if (!peer.sector) problems.sector = 'Elige el sector de la empresa.';
  if (!COUNTRY_PATTERN.test(peer.country))
    problems.country = 'Escribe el código ISO de dos letras del país (por ejemplo, MX).';
  return problems;
}

/** The fields the API marked in its error details (`body.name` → `name`). */
function serverFields(error: ApiError | null): ReadonlySet<string> {
  return new Set((error?.details ?? []).map((detail) => detail.field.replace(/^body\./, '')));
}

/**
 * Empresas pares (docs/13 §9 paso 3): companies of the same sector that Hermes looks for in the news (their names
 * and aliases feed the keyword filter and the R3 relevance). Every role reads the list, cursor-paginated; an admin
 * adds, edits and removes peers (removal asks first). API refusals (a repeated name or alias, an unknown sector)
 * are shown with the API message, and the fields it names are marked.
 */
@Component({
  selector: 'app-peers-panel',
  imports: [
    FormsModule,
    AsyncStateComponent,
    IfRoleDirective,
    LucideChevronLeft,
    LucideChevronRight,
    LucidePencil,
    LucidePlus,
    LucideTrash2,
    LucideUsers,
    LucideX,
  ],
  templateUrl: './peers-panel.html',
  styleUrls: ['./company-forms.css', './peers-panel.css'],
})
export class PeersPanel implements OnInit {
  private readonly service = inject(CompanyService);
  private readonly destroyRef = inject(DestroyRef);

  /** Peers are edited by admins only (FRONTEND.md §3, ROUTE_ROLES of /api/peer-companies). */
  readonly editRole: Role = 'admin';
  readonly sectorName = sectorName;
  readonly countryName = countryName;

  readonly pager = new CursorPager<PeerCompany>((cursor) =>
    this.service.listPeers(cursor, PEER_PAGE_SIZE),
  );
  readonly notice = signal<string | null>(null);

  /** The form: closed, adding a new peer, or editing the peer with this id. */
  readonly mode = signal<'closed' | 'new' | 'edit'>('closed');
  readonly editingId = signal<string | null>(null);
  readonly name = signal('');
  readonly aliases = signal<string[]>([]);
  readonly aliasInput = signal('');
  readonly aliasError = signal<string | null>(null);
  readonly domain = signal('');
  readonly sector = signal('');
  readonly country = signal('');
  readonly submitted = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<ApiError | null>(null);
  /** Sector of the peer being edited, kept as an option even if the catalog does not list it. */
  private readonly savedSector = signal('');

  /** Peer waiting for the confirmation of its removal, and the removal in flight. */
  readonly removingId = signal<string | null>(null);
  readonly removing = signal(false);
  readonly removeError = signal<string | null>(null);

  readonly draft = computed<PeerCompanyInput>(() => ({
    name: this.name().trim(),
    aliases: this.aliases(),
    domain: this.domain().trim() || null,
    sector: this.sector(),
    country: this.country().trim().toUpperCase(),
  }));
  readonly problems = computed(() => (this.submitted() ? peerProblems(this.draft()) : {}));
  private readonly marked = computed(() => serverFields(this.saveError()));
  readonly sectorOptions = computed(() => [
    ...new Set([...SECTOR_CODES, this.savedSector()].filter(Boolean)),
  ]);

  constructor() {
    this.destroyRef.onDestroy(() => this.pager.state.cancel());
  }

  ngOnInit(): void {
    this.pager.first();
  }

  /** Whether a field has a problem, found here or named by the API. */
  invalid(field: PeerField): boolean {
    return !!this.problems()[field] || this.marked().has(field);
  }

  startNew(): void {
    this.openForm('new', null, {
      name: '',
      aliases: [],
      domain: null,
      sector: '',
      country: '',
    });
  }

  startEdit(peer: PeerCompany): void {
    this.openForm('edit', peer.id, peer);
  }

  cancelForm(): void {
    if (this.saving()) return;
    this.mode.set('closed');
    this.editingId.set(null);
  }

  addAlias(event?: Event): void {
    event?.preventDefault();
    const alias = this.aliasInput().trim().replace(/\s+/g, ' ');
    if (!alias) return;
    if (alias.length > MAX_NAME) {
      this.aliasError.set(`Cada alias admite hasta ${MAX_NAME} caracteres.`);
      return;
    }
    if (this.aliases().some((item) => item.toLowerCase() === alias.toLowerCase())) {
      this.aliasError.set(`«${alias}» ya está en la lista.`);
      return;
    }
    if (this.aliases().length >= MAX_ALIASES) {
      this.aliasError.set(`Una empresa admite hasta ${MAX_ALIASES} alias.`);
      return;
    }
    this.aliases.update((items) => [...items, alias]);
    this.aliasInput.set('');
    this.aliasError.set(null);
  }

  removeAlias(alias: string): void {
    this.aliases.update((items) => items.filter((item) => item !== alias));
  }

  save(): void {
    this.submitted.set(true);
    if (this.saving() || Object.keys(peerProblems(this.draft())).length) return;
    const id = this.editingId();
    const request: Observable<PeerCompany> =
      this.mode() === 'edit' && id
        ? this.service.updatePeer(id, this.draft())
        : this.service.createPeer(this.draft());
    const adding = this.mode() === 'new';
    this.saving.set(true);
    this.saveError.set(null);
    request
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved) => {
          this.mode.set('closed');
          this.editingId.set(null);
          this.notice.set(adding ? `${saved.name} se agregó.` : `${saved.name} se guardó.`);
          // The list is ordered by name: a new peer may land on any page, so the list starts over.
          if (adding) this.pager.first();
          else this.pager.reload();
        },
        error: (error: unknown) => this.saveError.set(toApiError(error)),
      });
  }

  askRemove(peer: PeerCompany): void {
    this.removeError.set(null);
    this.removingId.set(peer.id);
  }

  cancelRemove(): void {
    if (this.removing()) return;
    this.removingId.set(null);
    this.removeError.set(null);
  }

  confirmRemove(peer: PeerCompany): void {
    if (this.removing()) return;
    this.removing.set(true);
    this.removeError.set(null);
    this.service
      .deletePeer(peer.id)
      .pipe(
        finalize(() => this.removing.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.removingId.set(null);
          this.notice.set(`${peer.name} se quitó de las empresas pares.`);
          // The last peer of a later page leaves it empty: show the page before it instead.
          if (this.pager.items().length === 1 && this.pager.hasPrevious()) this.pager.previous();
          else this.pager.reload();
        },
        error: (error: unknown) => this.removeError.set(toApiError(error).message),
      });
  }

  private openForm(mode: 'new' | 'edit', id: string | null, peer: PeerCompanyInput): void {
    this.mode.set(mode);
    this.editingId.set(id);
    this.name.set(peer.name);
    this.aliases.set([...(peer.aliases ?? [])]);
    this.aliasInput.set('');
    this.aliasError.set(null);
    this.domain.set(peer.domain ?? '');
    this.sector.set(peer.sector);
    this.savedSector.set(peer.sector);
    this.country.set(peer.country);
    this.submitted.set(false);
    this.saveError.set(null);
    this.notice.set(null);
    this.removingId.set(null);
  }
}
