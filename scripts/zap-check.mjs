// Decides the ZAP baseline result (scripts/zap.sh): fails on every Low, Medium or High alert of the JSON report that
// is not listed in the accepted file. Informational alerts are always printed but never fail the gate (user decision
// D-094, 27 Nov 2026: ZAP 10049 classifies every response by its cache headers and 10109 only notes a single-page
// app, so no header can clear them). An accepted entry names the alert by its `alertRef` (the ZAP rule id, with a
// suffix for the variants of one rule, such as 10055-6) and must give the reason it is accepted.
// Usage: node scripts/zap-check.mjs <report.json> <accepted-alerts.json>
import { readFileSync } from 'node:fs';

const [reportPath, acceptedPath] = process.argv.slice(2);
if (!reportPath || !acceptedPath) {
  console.error('usage: node scripts/zap-check.mjs <report.json> <accepted-alerts.json>');
  process.exit(2);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const accepted = JSON.parse(readFileSync(acceptedPath, 'utf8'));
const reasons = new Map();
for (const entry of accepted) {
  if (!entry.alertRef || !entry.reason?.trim()) {
    console.error(`✖ accepted alert without alertRef or reason: ${JSON.stringify(entry)}`);
    process.exit(2);
  }
  reasons.set(String(entry.alertRef), entry.reason);
}

const RISK = { 0: 'Informational', 1: 'Low', 2: 'Medium', 3: 'High' };
const failures = [];
const seen = new Set();
for (const site of report.site ?? []) {
  for (const alert of site.alerts ?? []) {
    const ref = String(alert.alertRef ?? alert.pluginid);
    seen.add(ref);
    const where = (alert.instances ?? [])
      .slice(0, 3)
      .map((instance) => `${instance.method} ${instance.uri}`)
      .join(', ');
    const line = `${ref} ${alert.name ?? alert.alert} [${RISK[alert.riskcode] ?? alert.riskcode}] (${alert.count} instances: ${where})`;
    if (reasons.has(ref)) {
      console.log(`accepted ${line}\n  reason: ${reasons.get(ref)}`);
    } else if (Number(alert.riskcode) === 0) {
      console.log(`info (does not block) ${line}`);
    } else {
      failures.push(line);
    }
  }
}

for (const ref of reasons.keys()) {
  if (!seen.has(ref)) console.log(`note: accepted alert ${ref} did not appear in this scan`);
}
if (failures.length) {
  console.error(`✖ ZAP found ${failures.length} alert(s) that are not accepted:`);
  for (const line of failures) console.error(`  ${line}`);
  process.exit(1);
}
console.log('✔ ZAP baseline: no Low, Medium or High alerts besides the accepted ones');
