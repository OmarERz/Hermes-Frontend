import { filterPage, groupByVulnerability } from './grouping';
import { recommendation } from './recommendation.fixtures';

const NEWEST = recommendation({ assessment_id: 'a-3', feedback_count: 0 });
const ALERT = recommendation({
  assessment_id: 'a-2',
  cve: null,
  product: null,
  level: 'critical',
  feedback_count: 2,
});
const OLDER = recommendation({ assessment_id: 'a-1', level: 'medium', feedback_count: 1 });
const OTHER = recommendation({
  assessment_id: 'a-0',
  cve: 'CVE-2026-20002',
  product: 'nginx 1.25',
});

describe('grouping by vulnerability', () => {
  it('groups the evaluations of one CVE and product, in the order of the newest', () => {
    const groups = groupByVulnerability([NEWEST, ALERT, OLDER, OTHER]);
    expect(groups.map((group) => [group.title, group.subtitle, group.items.length])).toEqual([
      ['CVE-2026-10001', 'OpenSSL 3.0.7', 2],
      ['Alerta inferida por IA', 'srv-pagos-01', 1],
      ['CVE-2026-20002', 'nginx 1.25', 1],
    ]);
    expect(groups[0].items.map((item) => item.assessment_id)).toEqual(['a-3', 'a-1']);
    expect(groups[0].withoutFeedback).toBe(1);
  });

  it('keeps every alert as a case of its own, with or without a direct asset', () => {
    const lone = recommendation({ assessment_id: 'a-9', cve: null, product: null, asset: null });
    const groups = groupByVulnerability([ALERT, lone]);
    expect(groups.map((group) => group.subtitle)).toEqual(['srv-pagos-01', 'Sin activo directo']);
  });

  it('filters the page by level and by «sin feedback»', () => {
    const page = [NEWEST, ALERT, OLDER, OTHER];
    expect(filterPage(page, { level: '', withoutFeedback: false })).toEqual(page);
    expect(filterPage(page, { level: 'critical', withoutFeedback: false })).toEqual([ALERT]);
    expect(filterPage(page, { level: '', withoutFeedback: true })).toEqual([NEWEST, OTHER]);
    expect(filterPage(page, { level: 'medium', withoutFeedback: true })).toEqual([]);
  });
});
