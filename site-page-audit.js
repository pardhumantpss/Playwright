// Browser page-load audit for a public page: Web Vitals, page weight, and which requests reach the origin
// (Cloudflare did not serve them from cache). node site-page-audit.js <url> [runs] [out.json]
const { chromium } = require('playwright');
const fs = require('fs');
const URL_ = process.argv[2] || 'https://www.leecycle.io/';
const RUNS = Number(process.argv[3] || 3);
const OUT = process.argv[4];

async function run(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__perf = { lcp: 0, cls: 0, tbt: 0 };
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__perf.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__perf.tbt += Math.max(0, e.duration - 50); }).observe({ type: 'longtask', buffered: true });
  });
  const host = new URL(URL_).host;
  const origin = [], failed = [], statuses = [];
  page.on('response', async r => {
    const u = new URL(r.url());
    if (u.host !== host) return;
    const cs = r.headers()['cf-cache-status'] || '';
    statuses.push(r.status());
    if (cs !== 'HIT' && !u.pathname.startsWith('/cdn-cgi/')) origin.push({ path: u.pathname + u.search, status: r.status(), cache: cs || 'none', method: r.request().method() });
  });
  page.on('requestfailed', r => failed.push(r.url()));
  const t0 = Date.now();
  const resp = await page.goto(URL_, { waitUntil: 'load', timeout: 120000 });
  const loadWall = Date.now() - t0;
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    const res = performance.getEntriesByType('resource');
    let transfer = n.transferSize;
    for (const r of res) transfer += r.transferSize;
    const largest = [...res].sort((a, b) => b.transferSize - a.transferSize).slice(0, 8)
      .map(r => ({ url: r.name.replace(location.origin, ''), kb: Math.round(r.transferSize / 1024) }));
    return { ttfb: Math.round(n.responseStart - n.startTime), fcp: fcp ? Math.round(fcp.startTime) : null, lcp: Math.round(window.__perf.lcp),
      domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), cls: +window.__perf.cls.toFixed(3), tbt: Math.round(window.__perf.tbt),
      requests: res.length + 1, transferKB: Math.round(transfer / 1024), largest };
  });
  await ctx.close();
  return { status: resp.status(), loadWall, ...m, originRequests: origin, failed };
}

(async () => {
  const browser = await chromium.launch();
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const r = await run(browser);
    runs.push(r);
    console.log(`run ${i + 1}: status=${r.status} ttfb=${r.ttfb} fcp=${r.fcp} lcp=${r.lcp} load=${r.load} weight=${r.transferKB}KB requests=${r.requests} originHits=${r.originRequests.length}`);
  }
  await browser.close();
  const med = k => { const a = runs.map(r => r[k]).filter(v => v != null).sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
  const summary = { url: URL_, runs: RUNS, median: Object.fromEntries(['ttfb', 'fcp', 'lcp', 'domContentLoaded', 'load', 'cls', 'tbt', 'requests', 'transferKB'].map(k => [k, med(k)])),
    originRequests: runs[runs.length - 1].originRequests, largest: runs[0].largest, failed: [...new Set(runs.flatMap(r => r.failed))] };
  console.log(JSON.stringify(summary, null, 1));
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ summary, runs }, null, 1));
})();
