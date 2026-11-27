import type { ConfigEditor } from './config-editor';
import { optionLabel } from './config-model';

export const PROFILE_KEY = 'sensitivity_profile';
export const DEAD_ZONE_KEY = 'dead_zone';

/**
 * Dead zone of each profile (docs/07 §12, D-091). Saving only `sensitivity_profile` keeps the current `dead_zone`,
 * so choosing a profile also drafts its dead zone: the simulation and the save send both.
 */
export const PROFILE_DEAD_ZONES: Readonly<Record<string, number>> = {
  minimal: 6,
  normal: 4,
  broad: 2,
};

/** What each profile of docs/07 §12 does, for the profile cards; an unknown option shows only its name. */
const PROFILE_TEXT: Readonly<Record<string, string>> = {
  minimal: 'El juez solo puede subir la puntuación y sus ajustes valen la mitad (×0.5).',
  normal: 'Rangos de referencia (×1). Puede bajar la puntuación si hay una fuente N1.',
  broad: 'Ajustes más amplios (×1.5). Puede bajar la puntuación si hay una fuente N1.',
};
/** Display order of the known profiles (the API lists its options alphabetically); others go last. */
const PROFILE_ORDER = ['minimal', 'normal', 'broad'];

export interface ProfileCard {
  value: string;
  label: string;
  text: string;
  deadZone: number | null;
}

/** The profile cards of the options the schema lists, in display order. */
export function profileCards(options: readonly string[]): ProfileCard[] {
  const rank = (option: string) => {
    const index = PROFILE_ORDER.indexOf(option);
    return index < 0 ? PROFILE_ORDER.length : index;
  };
  return [...options]
    .sort((a, b) => rank(a) - rank(b))
    .map((option) => ({
      value: option,
      label: optionLabel(PROFILE_KEY, option),
      text: PROFILE_TEXT[option] ?? '',
      deadZone: PROFILE_DEAD_ZONES[option] ?? null,
    }));
}

/**
 * Drafts a profile together with its dead zone (D-091). Going back to the saved profile restores the saved dead zone,
 * so clicking around never leaves a dead zone change behind; an unknown profile, or a schema without `dead_zone`,
 * keeps the dead zone.
 */
export function chooseProfile(editor: ConfigEditor, profile: string): void {
  editor.set(PROFILE_KEY, profile);
  if (!editor.parameters().some((param) => param.key === DEAD_ZONE_KEY)) return;
  const target =
    profile === editor.current(PROFILE_KEY)
      ? editor.current(DEAD_ZONE_KEY)
      : PROFILE_DEAD_ZONES[profile]?.toString();
  if (target !== undefined) editor.set(DEAD_ZONE_KEY, target);
}

/** True when `key` is the dead zone that the drafted profile brought along (a profile change, not an edit). */
export function followsProfile(editor: ConfigEditor, key: string): boolean {
  const deadZone = PROFILE_DEAD_ZONES[editor.value(PROFILE_KEY)];
  return (
    key === DEAD_ZONE_KEY &&
    editor.isChanged(PROFILE_KEY) &&
    deadZone !== undefined &&
    editor.value(DEAD_ZONE_KEY) === String(deadZone)
  );
}
