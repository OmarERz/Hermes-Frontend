import type { Level } from '../../shared/labels';
import type { Recommendation } from './feedback';

/**
 * The «casos» of the Recomendaciones screen (RE-1): the evaluations of the loaded page grouped by vulnerability
 * (CVE and product), as Hermes groups its findings. An alert inferred by the AI has no CVE: it is a case of its own.
 */
export interface RecommendationGroup {
  key: string;
  /** The CVE, or «Alerta inferida por IA». */
  title: string;
  /** The product, or for an alert the asset it points at. */
  subtitle: string;
  /** Its evaluations, newest first (the order of the API). */
  items: Recommendation[];
  /** Evaluations without any active feedback. */
  withoutFeedback: number;
}

export function groupKey(recommendation: Recommendation): string {
  return recommendation.cve
    ? `cve:${recommendation.cve}|${recommendation.product ?? ''}`
    : `alert:${recommendation.assessment_id}`;
}

/** Groups keep the order of their newest evaluation. */
export function groupByVulnerability(items: readonly Recommendation[]): RecommendationGroup[] {
  const groups = new Map<string, RecommendationGroup>();
  for (const item of items) {
    const key = groupKey(item);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        title: item.cve ?? 'Alerta inferida por IA',
        subtitle: item.cve
          ? (item.product ?? 'Producto sin nombre')
          : (item.asset?.name ?? 'Sin activo directo'),
        items: [],
        withoutFeedback: 0,
      };
      groups.set(key, group);
    }
    group.items.push(item);
    if (item.feedback_count === 0) group.withoutFeedback += 1;
  }
  return [...groups.values()];
}

/**
 * Filters of RE-2. The list route does not filter by level, verdict or feedback yet (they arrive with F18.1), so
 * these apply to the loaded page; the verdict filter waits for the route, because the list does not carry it.
 */
export interface PageFilters {
  level: Level | '';
  withoutFeedback: boolean;
}

export function filterPage(
  items: readonly Recommendation[],
  filters: PageFilters,
): Recommendation[] {
  return items.filter(
    (item) =>
      (!filters.level || item.level === filters.level) &&
      (!filters.withoutFeedback || item.feedback_count === 0),
  );
}
