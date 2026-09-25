// Stepped load test with JSON output and auto-abort on error rate > 5%
const [target, stepsArg, durS, outFile] = process.argv.slice(2);
const steps = stepsArg.split(',').map(Number), dur = Number(durS) * 1000;
const fs = await import('fs');
const pct = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;
const results = [];
for (const vus of steps) {
  const lat = [], codes = {}, perSec = {}; let errs = 0; const start = Date.now(), end = start + dur;
  await Promise.all(Array.from({ length: vus }, async () => {
    while (Date.now() < end) {
      const t = performance.now();
      try {
        const r = await fetch(target, { headers: { 'Accept-Encoding': 'br, gzip', 'User-Agent': 'leeact-perf-test' }, signal: AbortSignal.timeout(30000) });
        await r.arrayBuffer(); const ms = performance.now() - t;
        codes[r.status] = (codes[r.status] || 0) + 1; lat.push(ms);
        const s = Math.floor((Date.now() - start) / 1000); (perSec[s] ||= []).push(ms);
      } catch { errs++; }
    }
  }));
  lat.sort((a, b) => a - b); const n = lat.length;
  const bad = errs + Object.entries(codes).filter(([c]) => c >= 400).reduce((a, [, v]) => a + v, 0);
  const row = { vus, reqs: n, rps: +(n / (dur / 1000)).toFixed(1), avg: Math.round(lat.reduce((a, b) => a + b, 0) / n), p50: Math.round(pct(lat, .5)), p90: Math.round(pct(lat, .9)), p95: Math.round(pct(lat, .95)), p99: Math.round(pct(lat, .99)), max: Math.round(lat[n - 1] || 0), codes, netErrors: errs, errorRate: +(bad / (n + errs) * 100).toFixed(2),
    timeline: Object.entries(perSec).map(([s, a]) => { a.sort((x, y) => x - y); return { s: +s, rps: a.length, p50: Math.round(pct(a, .5)), p95: Math.round(pct(a, .95)) }; }) };
  results.push(row);
  console.log(`VUs=${vus} rps=${row.rps} p50=${row.p50} p95=${row.p95} p99=${row.p99} max=${row.max} codes=${JSON.stringify(codes)} netErr=${errs} errRate=${row.errorRate}%`);
  fs.writeFileSync(outFile, JSON.stringify({ target, stepDurationS: +durS, results }, null, 1));
  if (row.errorRate > 5) { console.log('ABORT: error rate above 5%'); break; }
  await new Promise(r => setTimeout(r, 5000)); // cool-down between steps
}
