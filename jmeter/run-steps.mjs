// Stepped JMeter load test: runs leecycle-load.jmx once per user step, stops early when errors pass 5% or
// p95 passes MAX_P95_MS, then builds one JMeter HTML dashboard over all steps.
// node jmeter/run-steps.mjs [--users 5,10,15,20,25] [--seconds 30] [--rampup 5] [--pages leecycle-pages.csv]
//                           [--host www.leecycle.io] [--with-css] [--think 0] [--out load-results/jmeter/<name>]
// node jmeter/run-steps.mjs --rebuild --out <folder>   recomputes the summary and report of a finished run, sending no traffic
// Needs JMeter (JMETER_HOME, or jmeter on PATH) and Java (JAVA_HOME, or java on PATH). With JMETER_HOME the
// script starts ApacheJMeter.jar with Java itself, so it works the same on Windows, macOS and Linux.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const flag = name => args.includes('--' + name);

const steps = opt('users', '5,10,15,20,25').split(',').map(Number);
let seconds = Number(opt('seconds', '30'));
let rampup = Number(opt('rampup', '5'));
let pages = opt('pages', 'leecycle-pages.csv');
let host = opt('host', 'www.leecycle.io');
let withCss = flag('with-css');
const think = Number(opt('think', '0'));
const rebuild = flag('rebuild');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const out = path.resolve(opt('out', path.join('load-results', 'jmeter', stamp)));
const MAX_VUS = 100;
const MAX_P95_MS = Number(process.env.MAX_P95_MS || 15000);
if (rebuild) ({ host, pages, withCss, seconds, rampup } = JSON.parse(fs.readFileSync(path.join(out, 'summary.json'), 'utf8')));

if (steps.some(v => !Number.isInteger(v) || v < 1)) { console.error('Users must be positive whole numbers, e.g. --users 5,10,25'); process.exit(1); }
if (Math.max(...steps) > MAX_VUS && process.env.ALLOW_HIGH_LOAD !== '1') {
  console.error(`Refusing to run more than ${MAX_VUS} users against a live site. Set ALLOW_HIGH_LOAD=1 if this is approved.`);
  process.exit(1);
}

const jmeterHome = process.env.JMETER_HOME;
const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', 'java') : 'java';
const runJmeter = jmArgs => (jmeterHome
  ? spawnSync(java, ['-Xms1g', '-Xmx1g', '-XX:MaxMetaspaceSize=256m', '-jar', path.join(jmeterHome, 'bin', 'ApacheJMeter.jar'), ...jmArgs], { stdio: 'inherit' })
  : spawnSync('jmeter', jmArgs, { stdio: 'inherit' }));

// JTL files are CSV; a quoted field (such as an assertion's failure message) can hold commas and line breaks
function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const readJtl = file => {
  const [head, ...rows] = parseCsv(fs.readFileSync(file, 'utf8'));
  return rows.map(r => Object.fromEntries(r.map((v, i) => [head[i], v])));
};
const pct = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0);

function stats(rows, vus) {
  const t0 = Math.min(...rows.map(r => +r.timeStamp));
  const lat = rows.map(r => +r.elapsed).sort((a, b) => a - b);
  const codes = {}; let failed = 0, firstErrorS = null;
  const perLabel = {};
  for (const r of rows) {
    codes[r.responseCode] = (codes[r.responseCode] || 0) + 1;
    const l = (perLabel[r.label] ||= { lat: [], errors: 0 });
    l.lat.push(+r.elapsed);
    if (r.success !== 'true') {
      failed++; l.errors++;
      const s = Math.floor((+r.timeStamp - t0) / 1000); if (firstErrorS === null || s < firstErrorS) firstErrorS = s;
    }
  }
  const okCount = rows.length - failed;
  return {
    vus, seconds, samples: rows.length, rps: +(rows.length / seconds).toFixed(1), okPerSec: +(okCount / seconds).toFixed(1),
    avg: Math.round(lat.reduce((a, b) => a + b, 0) / (lat.length || 1)), p50: pct(lat, .5), p90: pct(lat, .9), p95: pct(lat, .95), p99: pct(lat, .99), max: lat[lat.length - 1] || 0,
    codes, failed, errorRate: +(failed / (rows.length || 1) * 100).toFixed(2), firstErrorS,
    perLabel: Object.fromEntries(Object.entries(perLabel).map(([k, v]) => { v.lat.sort((a, b) => a - b); return [k, { samples: v.lat.length, p50: pct(v.lat, .5), p95: pct(v.lat, .95), errors: v.errors }]; })),
  };
}

fs.mkdirSync(out, { recursive: true });
const plan = path.join(here, 'leecycle-load.jmx');
const results = []; let stopReason = null;
const tooBad = row => (row.errorRate > 5 ? `error rate ${row.errorRate}% at ${row.vus} users is above 5%`
  : row.p95 > MAX_P95_MS ? `p95 ${row.p95} ms at ${row.vus} users is above ${MAX_P95_MS} ms` : null);
if (rebuild) {
  for (const d of fs.readdirSync(out).filter(d => /^step-\d+-users$/.test(d)).sort()) {
    results.push(stats(readJtl(path.join(out, d, 'results.jtl')), Number(d.match(/\d+/)[0])));
  }
  stopReason = results.map(tooBad).find(Boolean) || null;
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ host, pages, withCss, seconds, rampup, results }, null, 1));
}
console.log(`JMeter stepped load test on https://${host} (${pages}${withCss ? ', with common.css' : ''}): users ${steps.join(', ')}, ${seconds} s each. Output: ${out}`);
for (const vus of rebuild ? [] : steps) {
  const dir = path.join(out, `step-${String(vus).padStart(3, '0')}-users`);
  fs.mkdirSync(dir, { recursive: true });
  const jtl = path.join(dir, 'results.jtl');
  fs.rmSync(jtl, { force: true });
  const r = runJmeter(['-n', '-t', plan, '-l', jtl, '-j', path.join(dir, 'jmeter.log'),
    `-Jhost=${host}`, `-Jpages=${pages}`, `-Jusers=${vus}`, `-Jrampup=${Math.min(rampup, vus)}`, `-Jduration=${seconds}`,
    `-Jwith_css=${withCss}`, `-Jthink=${think}`, '-Jjmeter.save.saveservice.output_format=csv', '-Jsummariser.interval=10']);
  if (r.error || r.status !== 0 || !fs.existsSync(jtl)) {
    stopReason = r.error ? `could not start JMeter (${r.error.code}): set JMETER_HOME and JAVA_HOME` : `JMeter wrote no results at ${vus} users (exit code ${r.status})`;
    console.error(stopReason); break;
  }
  const row = stats(readJtl(jtl), vus);
  results.push(row);
  console.log(`STEP users=${vus} req/s=${row.rps} ok/s=${row.okPerSec} p50=${row.p50} p95=${row.p95} p99=${row.p99} max=${row.max} codes=${JSON.stringify(row.codes)} errRate=${row.errorRate}%${row.firstErrorS != null ? ` firstErrorAt=${row.firstErrorS}s` : ''}`);
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ host, pages, withCss, seconds, rampup, results }, null, 1));
  stopReason = tooBad(row);
  if (stopReason) { console.log(`ABORT: ${stopReason}`); break; }
  if (vus !== steps[steps.length - 1]) await new Promise(res => setTimeout(res, 5000)); // cool-down between steps
}

// One dashboard over every step: join the step files (one header) and let JMeter build the HTML report
const jtls = results.map(r => path.join(out, `step-${String(r.vus).padStart(3, '0')}-users`, 'results.jtl'));
if (jtls.length) {
  const all = path.join(out, 'all-steps.jtl');
  // Keep each file whole apart from the header line of the second and later files (quoted fields can span lines)
  const texts = jtls.map(f => fs.readFileSync(f, 'utf8').replace(/\r?\n?$/, '\n'));
  fs.writeFileSync(all, texts.map((t, i) => (i ? t.slice(t.indexOf('\n') + 1) : t)).join(''));
  const report = path.join(out, 'report');
  fs.rmSync(report, { recursive: true, force: true });
  runJmeter(['-g', all, '-o', report, '-j', path.join(out, 'report.log'),
    '-Jjmeter.reportgenerator.overall_granularity=5000', `-Jjmeter.reportgenerator.report_title=JMeter load test: ${host}`]);
  console.log(`HTML report: ${path.join(report, 'index.html')}`);
}

const lines = [`## JMeter load test: https://${host}`, '', `${pages}${withCss ? ' + common.css' : ''}, ${seconds} s per step`, '',
  '| Users | Req/s | OK/s | p50 | p95 | p99 | Max | Samples | Failed |', '|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...results.map(r => `| ${r.vus} | ${r.rps} | ${r.okPerSec} | ${r.p50} ms | ${r.p95} ms | ${r.p99} ms | ${r.max} ms | ${r.samples} | ${r.errorRate}% |`)];
if (stopReason) lines.push('', `**Stopped early:** ${stopReason}.`);
fs.writeFileSync(path.join(out, 'summary.md'), lines.join('\n') + '\n');
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n\n');
console.log('\n' + lines.join('\n'));
if (stopReason) process.exitCode = 1;
