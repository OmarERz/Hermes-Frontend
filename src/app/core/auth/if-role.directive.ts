import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import type { Role } from '../api/api-types';
import { SessionService } from './session.service';

/**
 * Renders its template only when the effective role reaches the given one: `*appIfRole="'analyst'"`.
 * Hides what the role cannot do (FRONTEND.md §1); the screens still handle a 403 from the API.
 */
@Directive({ selector: '[appIfRole]' })
export class IfRoleDirective {
  readonly appIfRole = input.required<Role>();

  private readonly session = inject(SessionService);
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private shown = false;

  constructor() {
    effect(() => {
      const allowed = this.session.hasRole(this.appIfRole());
      if (allowed && !this.shown) {
        this.container.createEmbeddedView(this.template);
        this.shown = true;
      } else if (!allowed && this.shown) {
        this.container.clear();
        this.shown = false;
      }
    });
  }
}
