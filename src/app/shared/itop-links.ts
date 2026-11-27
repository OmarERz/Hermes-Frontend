import { Component, computed, inject, input } from '@angular/core';
import { LucideExternalLink } from '@lucide/angular';
import { APP_CONFIG } from '../core/config/app-config';

/**
 * Links to the iTop console. iTop is the inventory (D-003, D-088): the front never edits a CI, it links to iTop
 * («Editar en iTop» / «Crear en iTop»). Only absolute http(s) URLs are ever rendered.
 */
export type ItopLinkKind = 'view' | 'edit' | 'create';

const LABELS: Record<ItopLinkKind, string> = {
  view: 'Ver en iTop',
  edit: 'Editar en iTop',
  create: 'Crear en iTop',
};

/** The URL if it is an absolute http(s) URL without credentials; anything else is dropped. */
export function safeExternalUrl(url: unknown): string | null {
  if (typeof url !== 'string' || !url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function itopPage(base: string | null, params: Record<string, string>): string | null {
  const root = safeExternalUrl(base);
  if (!root) return null;
  const url = new URL('pages/UI.php', root.endsWith('/') ? root : `${root}/`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

/** Details page of a CI (`kind` view) or its edit form (`kind` edit) in the iTop console. */
export function itopObjectUrl(
  base: string | null,
  itopClass: string,
  id: string | number,
  kind: 'view' | 'edit' = 'view',
): string | null {
  if (!itopClass || id === '' || id === null || id === undefined) return null;
  return itopPage(base, {
    operation: kind === 'edit' ? 'modify' : 'details',
    class: itopClass,
    id: String(id),
  });
}

/** The iTop form to create an object of `itopClass`. */
export function itopCreateUrl(base: string | null, itopClass: string): string | null {
  if (!itopClass) return null;
  return itopPage(base, { operation: 'new', class: itopClass });
}

/**
 * `<app-itop-link kind="edit" [href]="asset.itop_url" />` or, built from the configured console,
 * `<app-itop-link kind="create" itopClass="Server" />`. Renders nothing when there is no safe URL.
 */
@Component({
  selector: 'app-itop-link',
  imports: [LucideExternalLink],
  template: `
    @if (url(); as target) {
      <a class="itop-link" [href]="target" target="_blank" rel="noopener noreferrer"
        >{{ label() }}<svg lucideExternalLink aria-hidden="true"></svg
        ><span class="visually-hidden"> (se abre en otra pestaña)</span></a
      >
    }
  `,
  styles: `
    .itop-link {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      color: var(--accent-text, #c9007f);
      font-weight: var(--weight-semibold);
      text-decoration: none;
      white-space: nowrap;
    }
    .itop-link:hover {
      text-decoration: underline;
    }
    .itop-link:focus-visible {
      outline: var(--focus-ring);
      outline-offset: var(--focus-offset);
    }
    .itop-link svg {
      width: 14px;
      height: 14px;
    }
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  `,
})
export class ItopLink {
  readonly kind = input<ItopLinkKind>('view');
  /** A URL from the API (for example `itop_url` of a CI); it wins over the built one. */
  readonly href = input<string | null | undefined>(null);
  readonly itopClass = input('');
  readonly itopId = input<string | number | null>(null);

  private readonly base = inject(APP_CONFIG).itopBaseUrl;

  readonly label = computed(() => LABELS[this.kind()]);
  readonly url = computed(() => {
    const direct = safeExternalUrl(this.href());
    if (direct) return direct;
    const kind = this.kind();
    if (kind === 'create') return itopCreateUrl(this.base, this.itopClass());
    const id = this.itopId();
    return id === null ? null : itopObjectUrl(this.base, this.itopClass(), id, kind);
  });
}
