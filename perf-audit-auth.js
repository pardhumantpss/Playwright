// Authenticated page-load audit: node perf-audit-auth.js <out.json> <url1> <url2> ...
const { chromium } = require('playwright');
const fs = require('fs');
const [OUT, ...URLS] = process.argv.slice(2);
const STATE = '.auth/tp-state.json';
const PROFILES = [
  { name: 'Desktop (no throttle)', mobile: false, throttle: false, runs: 3 },
  { name: 'Mobile (Slow 4G + 4x CPU)', mobile: true, throttle: true, runs: 2 },
];

async function run(browser, url, profile) {
  const ctx = await browser.newContext({
    storageState: STATE,
    ...(profile.mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 13) Mobile Chrome/120' }
      : { viewport: { width: 1366, height: 768 } }),
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (profile.throttle) {
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  await page.addInitScript(() => {
    window.__perf = { lcp: 0, cls: 0, longTasks: 0, tbt: 0 };
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__perf.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) { window.__perf.longTasks++; window.__perf.tbt += Math.max(0, e.duration - 50); } }).observe({ type: 'longtask', buffered: true });
  });
  const api = [];
  const errors = [];
  page.on('requestfinished', async r => {
    if (!['fetch', 'xhr'].includes(r.resourceType())) return;
    const t = r.timing();
    const resp = await r.response().catch(() => null);
    api.push({ url: r.url().split('?')[0], method: r.method(), status: resp ? resp.status() : 0, ms: Math.round(t.responseEnd) });
  });
  page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url().split('?')[0]); });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  const wall = Date.now() - t0;
  await page.waitForTimeout(2500);
  const finalUrl = page.url();
  const m = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    const res = performance.getEntriesByType('resource');
    let transfer = n.transferSize, decoded = n.decodedBodySize;
    for (const r of res) { transfer += r.transferSize; decoded += r.decodedBodySize; }
    return {
      ttfb: n.responseStart - n.startTime, fcp: fcp ? fcp.startTime : null, lcp: window.__perf.lcp,
      domContentLoaded: n.domContentLoadedEventEnd, load: n.loadEventEnd, cls: window.__perf.cls,
      tbt: window.__perf.tbt, longTasks: window.__perf.longTasks, requests: res.length + 1,
      transferKB: transfer / 1024, decodedKB: decoded / 1024, domNodes: document.getElementsByTagName('*').length, title: document.title,
    };
  }).catch(e => ({ evalError: e.message }));
  await ctx.close();
  return { ...m, wall, finalUrl, redirectedToLogin: /\/login/.test(finalUrl), api, errors: [...new Set(errors)] };
}

(async () => {
  const browser = await chromium.launch();
  const out = {};
  for (const url of URLS) {
    out[url] = {};
    for (const p of PROFILES) {
      out[url][p.name] = [];
      for (let i = 0; i < p.runs; i++) out[url][p.name].push(await run(browser, url, p));
      console.log('done', url, p.name);
    }
    fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  }
  await browser.close();
})();
