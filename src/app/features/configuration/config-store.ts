import { computed, DestroyRef, inject, Injectable } from '@angular/core';
import { forkJoin } from 'rxjs';
import { AsyncState } from '../../shared/async-state';
import { ConfigApi } from './config-api';
import type { ConfigDocument, ConfigParameter } from './config-model';

interface Snapshot {
  parameters: ConfigParameter[];
  document: ConfigDocument;
}

/**
 * The parameter schema and the current values of one configuration screen (provided by the page, so every
 * visit reads the current version). A save or a restore answers the new document, which replaces the old one.
 */
@Injectable()
export class ConfigStore {
  private readonly api = inject(ConfigApi);

  readonly state = new AsyncState<Snapshot>();
  readonly parameters = computed(() => this.state.value()?.parameters ?? []);
  readonly document = computed(() => this.state.value()?.document ?? null);
  readonly version = computed(() => this.document()?.version ?? null);
  readonly values = computed<Record<string, string>>(() => this.document()?.values ?? {});

  constructor() {
    inject(DestroyRef).onDestroy(() => this.state.cancel());
  }

  load(): void {
    this.state.run(forkJoin({ parameters: this.api.schema(), document: this.api.config() }));
  }

  /** Takes the document a write answered (its version and values are the current ones now). */
  accept(document: ConfigDocument): void {
    const snapshot = this.state.value();
    if (snapshot) this.state.value.set({ ...snapshot, document });
  }
}
