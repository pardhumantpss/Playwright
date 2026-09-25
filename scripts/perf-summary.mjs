// Turns perf-results/results.jsonl into a Markdown table.
// Writes to the GitHub Actions job summary when run in CI, otherwise prints it.
import fs from 'fs';

const FILE = 'perf-results/results.jsonl';
if (!fs.existsSync(FILE)) { console.log('No performance results found.'); process.exit(0); }
const rows = fs.readFileSync(FILE, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));

const COLS = [['ttfb', 'TTFB'], ['fcp', 'FCP'], ['lcp', 'LCP'], ['tbt', 'TBT'], ['cls', 'CLS'], ['readyMs', 'Ready'], ['transferKB', 'Downloaded'], ['requests', 'Requests'], ['apiMaxDuplicates', 'Max dup. API']];
const fmt = (k, v) => v == null ? '–'
  : k === 'cls' ? v.toFixed(3)
  : k.endsWith('KB') ? (v >= 1024 ? `${(v / 1024).toFixed(1)} MB` : `${Math.round(v)} KB`)
  : k === 'requests' || k === 'apiMaxDuplicates' ? String(Math.round(v))
  : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`;
// ❌ over budget · ⚠️ within budget but missing the target · ✅ meets the target · no mark: within budget, no target
const mark = (k, v, budget, targets) => {
  if (budget[k] != null && v > budget[k]) return '❌ ';
  if (targets[k] != null) return v <= targets[k] ? '✅ ' : '⚠️ ';
  return '';
};

let md = '## Performance results\n\n';
md += `| Page | Profile | ${COLS.map(c => c[1]).join(' | ')} |\n|---|---|${COLS.map(() => '---:').join('|')}|\n`;
for (const r of rows) {
  md += `| ${r.page} | ${r.profile} | ${COLS.map(([k]) => r.metrics[k] == null || (r.budgetOnly && r.budget[k] == null) ? '–' : mark(k, r.metrics[k], r.budget, r.targets) + fmt(k, r.metrics[k])).join(' | ')} |\n`;
}
md += '\n❌ over budget (regression) · ⚠️ within budget, misses the Core Web Vitals target · ✅ meets target · no mark: within budget, no target set\n';
const heavy = rows.filter(r => r.metrics.largestImageKB > 1024 || r.metrics.largestScriptKB > 500);
if (heavy.length) {
  md += '\n### Largest files\n\n| Page | Largest script | Largest image |\n|---|---|---|\n';
  for (const r of heavy) md += `| ${r.page} (${r.profile}) | \`${r.metrics.largestScript || '–'}\` ${fmt('KB', r.metrics.largestScriptKB)} | \`${r.metrics.largestImage || '–'}\` ${fmt('KB', r.metrics.largestImageKB)} |\n`;
}

if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
console.log(md);
