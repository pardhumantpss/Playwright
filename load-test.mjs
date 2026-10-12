// Stepped load test with JSON output. Stops early when errors pass 5% or p95 passes MAX_P95_MS.
// Target: one URL, a comma-separated list, or @file with one URL per line. With several URLs,
// each virtual user cycles through them (starting at a different one) and results are also reported per URL.
const [targetArg, stepsArg, durS, outFile] = process.argv.slice(2);
const fs = await import('fs');
if (!targetArg || !stepsArg || !durS || !outFile) {
  console.error('Usage: node load-test.mjs <url | url,url | @urls.txt> <users,users,...> <seconds-per-step> <out.json>');
  process.exit(1);
}
const urls = (targetArg.startsWith('@') ? fs.readFileSync(targetArg.slice(1), 'utf8').split(/\r?\n/) : targetArg.split(','))
  .map(u => u.trim()).filter(u => u && !u.startsWith('#'));
const steps = stepsArg.split(',').map(Number), dur = Number(durS) * 1000;
const MAX_VUS = 100;
const MAX_P95_MS = Number(process.env.MAX_P95_MS || 15000);
if (!urls.length) { console.error('No URLs to test'); process.exit(1); }
if (steps.some(v => !Number.isInteger(v) || v < 1)) { console.error('Steps must be positive whole numbers, e.g. 10,25,50'); process.exit(1); }
if (Math.max(...steps) > MAX_VUS && process.env.ALLOW_HIGH_LOAD !== '1') {
  console.error(`Refusing to run more than ${MAX_VUS} users against a live site. Set ALLOW_HIGH_LOAD=1 if this is approved.`);
  process.exit(1);
}
const pct = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;
const path = u => { try { const x = new URL(u); return x.pathname + x.search; } catch { return u; } };
const results = [];
for (const vus of steps) {
  const lat = [], codes = {}, perSec = {}, cache = {}, perUrl = {}; let errs = 0, blocked = 0;
  const start = Date.now(), end = start + dur;
  await Promise.all(Array.from({ length: vus }, async (_, vu) => {
    let i = vu;
    while (Date.now() < end) {
      const url = urls[i++ % urls.length];
      const u = (perUrl[path(url)] ||= { lat: [], bad: 0 });
      const t = performance.now();
      try {
        const r = await fetch(url, { headers: { 'Accept-Encoding': 'br, gzip', 'User-Agent': 'leeact-perf-test' }, signal: AbortSignal.timeout(30000) });
        await r.arrayBuffer(); const ms = performance.now() - t;
        codes[r.status] = (codes[r.status] || 0) + 1; lat.push(ms); u.lat.push(ms);
        if (r.status >= 400) u.bad++;
        const cs = r.headers.get('cf-cache-status'); if (cs) cache[cs] = (cache[cs] || 0) + 1;
        if (r.headers.get('cf-mitigated')) blocked++;
        const s = Math.floor((Date.now() - start) / 1000); (perSec[s] ||= []).push(ms);
      } catch { errs++; u.bad++; }
    }
  }));
  lat.sort((a, b) => a - b); const n = lat.length;
  const bad = errs + Object.entries(codes).filter(([c]) => c >= 400).reduce((a, [, v]) => a + v, 0);
  const row = { vus, reqs: n, rps: +(n / (dur / 1000)).toFixed(1), avg: Math.round(lat.reduce((a, b) => a + b, 0) / n), p50: Math.round(pct(lat, .5)), p90: Math.round(pct(lat, .9)), p95: Math.round(pct(lat, .95)), p99: Math.round(pct(lat, .99)), max: Math.round(lat[n - 1] || 0), codes, netErrors: errs, errorRate: +(bad / (n + errs) * 100).toFixed(2),
    cache, challenged: blocked,
    timeline: Object.entries(perSec).map(([s, a]) => { a.sort((x, y) => x - y); return { s: +s, rps: a.length, p50: Math.round(pct(a, .5)), p95: Math.round(pct(a, .95)) }; }) };
  if (urls.length > 1) row.perUrl = Object.fromEntries(Object.entries(perUrl).map(([p, { lat: a, bad: b }]) => {
    a.sort((x, y) => x - y); return [p, { reqs: a.length, p50: Math.round(pct(a, .5)), p95: Math.round(pct(a, .95)), max: Math.round(a[a.length - 1] || 0), errors: b }];
  }));
  results.push(row);
  console.log(`VUs=${vus} rps=${row.rps} p50=${row.p50} p95=${row.p95} p99=${row.p99} max=${row.max} codes=${JSON.stringify(codes)} cache=${JSON.stringify(cache)} netErr=${errs} errRate=${row.errorRate}%${blocked ? ` challenged=${blocked}` : ''}`);
  fs.writeFileSync(outFile, JSON.stringify({ target: urls.length > 1 ? urls : urls[0], stepDurationS: +durS, results }, null, 1));
  if (row.errorRate > 5) { console.log('ABORT: error rate above 5%'); break; }
  if (row.p95 > MAX_P95_MS) { console.log(`ABORT: p95 above ${MAX_P95_MS} ms`); break; }
  await new Promise(r => setTimeout(r, 5000)); // cool-down between steps
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [`## Load test: ${urls.length > 1 ? `${urls.length} URLs` : urls[0]}`, '', `${Number(durS)} s per step`, '',
    '| Users | Req/s | p50 | p95 | p99 | Max | Requests | Errors |', '|---:|---:|---:|---:|---:|---:|---:|---:|'];
  for (const r of results) lines.push(`| ${r.vus} | ${r.rps} | ${r.p50} ms | ${r.p95} ms | ${r.p99} ms | ${r.max} ms | ${r.reqs} | ${r.errorRate}% |`);
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n\n');
}
