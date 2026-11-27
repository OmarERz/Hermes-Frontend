import type { ConfigEditor } from './config-editor';
import { ConfigParameter, optionLabel } from './config-model';

export const PROFILE_KEY = 'sensitivity_profile';
export const DEAD_ZONE_KEY = 'dead_zone';
const RANGE_MULTIPLIER_KEY = 'judge.range_multiplier';
const ALLOW_LOWERING_KEY = 'judge.allow_lowering';
const MIN_CONFIDENCE_KEY = 'mode2.min_confidence';

/** What a profile sets: parameter → value, as text (like every value of the configuration API). */
export type ProfileValues = Readonly<Record<string, string>>;

/** Display order of the known profiles (the API lists its options alphabetically); others go last. */
const PROFILE_ORDER = ['minimal', 'normal', 'broad'];

/** An own entry of a record (never one of Object.prototype, whatever the key). */
function own<T>(
  record: Readonly<Record<string, T>> | null | undefined,
  key: string,
): T | undefined {
  return record && Object.hasOwn(record, key) ? record[key] : undefined;
}

/**
 * What `profile` sets, only as the schema publishes it in `option_values` (F18.6, read from the table the judge
 * applies): the front never repeats those values (FRONTEND.md §5, D-088). A profile or a value the schema leaves out
 * (or sends empty) sets nothing: its card shows no text or dead zone, and choosing it keeps the dead zone.
 */
export function profileValues(param: ConfigParameter | null, profile: string): ProfileValues {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(own(param?.option_values, profile) ?? {})) {
    if (typeof value === 'string' && value.trim() !== '') values[key] = value.trim();
  }
  return values;
}

/** The dead zone that `profile` brings along (D-091), as text; null when the schema does not publish it. */
export function profileDeadZone(param: ConfigParameter | null, profile: string): string | null {
  return own(profileValues(param, profile), DEAD_ZONE_KEY) ?? null;
}

/** What a profile does, for its card, from its values; empty when it publishes none of them. */
export function profileText(values: ProfileValues): string {
  const parts: string[] = [];
  const multiplier = own(values, RANGE_MULTIPLIER_KEY);
  const factor = multiplier === undefined ? NaN : Number(multiplier);
  if (Number.isFinite(factor)) {
    if (factor < 1) parts.push(`Ajustes más cortos que los rangos de referencia (×${multiplier}).`);
    else if (factor > 1) parts.push(`Ajustes más amplios (×${multiplier}).`);
    else parts.push(`Rangos de referencia (×${multiplier}).`);
  }
  const lowering = own(values, ALLOW_LOWERING_KEY);
  if (lowering === 'true') parts.push('Puede bajar la puntuación si hay una fuente N1.');
  if (lowering === 'false') parts.push('Solo puede subir la puntuación.');
  const confidence = own(values, MIN_CONFIDENCE_KEY);
  if (confidence !== undefined) {
    parts.push(`Modo 2: confianza mínima ${confidence}, si un admin no fija otra.`);
  }
  return parts.join(' ');
}

export interface ProfileCard {
  value: string;
  label: string;
  text: string;
  deadZone: string | null;
}

/** The profile cards of the options the schema lists, in display order, with what each one sets. */
export function profileCards(param: ConfigParameter | null): ProfileCard[] {
  const rank = (option: string) => {
    const index = PROFILE_ORDER.indexOf(option);
    return index < 0 ? PROFILE_ORDER.length : index;
  };
  return [...(param?.options ?? [])]
    .sort((a, b) => rank(a) - rank(b))
    .map((option) => {
      const values = profileValues(param, option);
      return {
        value: option,
        label: optionLabel(PROFILE_KEY, option),
        text: profileText(values),
        deadZone: own(values, DEAD_ZONE_KEY) ?? null,
      };
    });
}

/** The `sensitivity_profile` parameter of the screen, if the schema publishes it. */
function profileParameter(editor: ConfigEditor): ConfigParameter | null {
  return editor.parameters().find((param) => param.key === PROFILE_KEY) ?? null;
}

/**
 * Drafts a profile together with its dead zone (D-091): saving only `sensitivity_profile` would keep the current
 * `dead_zone`, so the simulation and the save send both. Going back to the saved profile restores the saved dead zone,
 * so clicking around never leaves a dead zone change behind; a profile without a dead zone, or a schema without
 * `dead_zone`, keeps the dead zone.
 */
export function chooseProfile(editor: ConfigEditor, profile: string): void {
  editor.set(PROFILE_KEY, profile);
  if (!editor.parameters().some((param) => param.key === DEAD_ZONE_KEY)) return;
  const target =
    profile === editor.current(PROFILE_KEY)
      ? editor.current(DEAD_ZONE_KEY)
      : profileDeadZone(profileParameter(editor), profile);
  if (target !== undefined && target !== null) editor.set(DEAD_ZONE_KEY, target);
}

/** True when `key` is the dead zone that the drafted profile brought along (a profile change, not an edit). */
export function followsProfile(editor: ConfigEditor, key: string): boolean {
  if (key !== DEAD_ZONE_KEY || !editor.isChanged(PROFILE_KEY)) return false;
  const deadZone = profileDeadZone(profileParameter(editor), editor.value(PROFILE_KEY));
  return deadZone !== null && editor.value(DEAD_ZONE_KEY) === deadZone;
}
