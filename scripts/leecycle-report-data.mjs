// Builds the data files for the www.leecycle.io load test report from the runs in load-results/.
// node scripts/leecycle-report-data.mjs [load-results] [out-dir]
// Writes steps.csv, timeline.csv, browser.csv and largest-files.csv. Upload them to the report's sources.
import fs from 'fs';
import path from 'path';

const dir = process.argv[2] || 'load-results';
const out = process.argv[3] || path.join(dir, 'report');
fs.mkdirSync(out, { recursive: true });
const load = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const csv = rows => {
  const cols = Object.keys(rows[0]);
  const cell = v => (typeof v === 'string' && /[,"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
  return [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\n') + '\n';
};

// Each run's name and its load-test.mjs output file
const runs = [
  ['Home page', 'leecycle-home.json'],
  ['Page mix', 'leecycle-mix.json'],
  ['Page mix, with browser', 'leecycle-mix-20-during-browser.json'],
  ['Page mix, steady', 'leecycle-soak-10.json'],
];
const steps = [], timeline = [];
for (const [run, file] of runs) {
  if (!fs.existsSync(path.join(dir, file))) { console.warn(`skipped ${run}: ${file} not found`); continue; }
  const j = load(file);
  for (const r of j.results) {
    const ok = r.codes['200'] || 0;
    steps.push({ run, users: r.vus, seconds: j.stepDurationS, pagesPerSec: r.rps, okPagesPerSec: +(ok / j.stepDurationS).toFixed(1),
      p50Ms: r.p50, p95Ms: r.p95, p99Ms: r.p99, maxMs: r.max, requests: r.reqs + r.netErrors, failed: r.reqs + r.netErrors - ok, errorRatePct: r.errorRate });
    for (const t of r.timeline) if (t.s < j.stepDurationS) timeline.push({ run, users: r.vus, second: t.s, pagesPerSec: t.rps, p95Ms: t.p95 });
  }
}
fs.writeFileSync(path.join(out, 'steps.csv'), csv(steps));
fs.writeFileSync(path.join(out, 'timeline.csv'), csv(timeline));

// site-page-audit.js output with the site idle and during a load run
const browser = [['Idle', 'leecycle-home-browser-idle.json'], ['During 20-user load', 'leecycle-home-browser-under-load.json']]
  .filter(([, f]) => fs.existsSync(path.join(dir, f)))
  .map(([condition, f]) => {
    const s = load(f).summary;
    return { condition, ttfbMs: s.median.ttfb, fcpMs: s.median.fcp, lcpMs: s.median.lcp, loadMs: s.median.load,
      weightMB: +(s.median.transferKB / 1024).toFixed(1), requests: s.median.requests, originHits: s.originRequests.length };
  });
if (browser.length) fs.writeFileSync(path.join(out, 'browser.csv'), csv(browser));

if (fs.existsSync(path.join(dir, 'leecycle-home-browser-idle.json'))) {
  const largest = load('leecycle-home-browser-idle.json').summary.largest.filter(x => x.url.startsWith('/'))
    .map(x => ({ file: x.url.split('/').pop(), path: x.url, sizeMB: +(x.kb / 1024).toFixed(2) }));
  fs.writeFileSync(path.join(out, 'largest-files.csv'), csv(largest));
}
console.log(`${steps.length} steps, ${timeline.length} timeline rows, ${browser.length} browser rows written to ${out}`);
