import { Component, computed, input } from '@angular/core';
import { LucideFlaskConical } from '@lucide/angular';
import { LEVELS } from '../../shared/labels';
import type { ConfigEditor } from './config-editor';
import { levelLabel } from './config-model';

/**
 * The preview of a draft (FRO-06): how many open findings change level, the before/after level matrix (rows:
 * level now; columns: level with the proposal, the diagonal keeps its level), the findings that move the most
 * and the parameters without a preview (FRO-04). It warns when the draft changed after simulating.
 */
@Component({
  selector: 'app-simulation-panel',
  imports: [LucideFlaskConical],
  templateUrl: './simulation-panel.html',
  styleUrl: './simulation-panel.css',
})
export class SimulationPanel {
  readonly editor = input.required<ConfigEditor>();

  readonly outcome = computed(() => this.editor().simulation.value());
  /** N-18 (F19.8): a role that cannot change any value of the screen is not told to change one. */
  readonly canChange = computed(() => {
    const editor = this.editor();
    return editor.parameters().some((param) => editor.canEdit(param));
  });
  readonly result = computed(() => this.outcome()?.result ?? null);

  /** Levels of the matrix: the four urgency levels, plus any other level the API answers. */
  readonly levels = computed(() => {
    const matrix = this.result()?.level_matrix ?? {};
    const extra = new Set<string>();
    for (const [before, row] of Object.entries(matrix)) {
      extra.add(before);
      for (const after of Object.keys(row)) extra.add(after);
    }
    const known: string[] = [...LEVELS];
    return [...known, ...[...extra].filter((level) => !known.includes(level))];
  });

  readonly notSimulable = computed(() => {
    const editor = this.editor();
    const names = new Map(editor.parameters().map((param) => [param.key, editor.label(param)]));
    return (this.outcome()?.notSimulable ?? []).map((key) => names.get(key) ?? key);
  });

  levelLabel(level: string): string {
    return levelLabel(level);
  }

  count(before: string, after: string): number {
    return this.result()?.level_matrix[before]?.[after] ?? 0;
  }
}
