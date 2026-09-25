// Browser page-load performance audit for tp.leeact.io
const { chromium } = require('playwright');
const URL = process.argv[2] || 'https://tp.leeact.io/login';
const RUNS = Number(process.argv[3] || 5);

async function run(browser, profile) {
  const ctx = await browser.newContext(profile.mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 13) Mobile Chrome/120' }
    : { viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (profile.throttle) {
    await cdp.send('Network.enable');
    // Lighthouse-like "Slow 4G": 150ms RTT, 1.6Mbps down, 750kbps up, 4x CPU
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  await page.addInitScript(() => {
    window.__perf = { lcp: 0, cls: 0, longTasks: 0, tbt: 0 };
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__perf.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) { window.__perf.longTasks++; window.__perf.tbt += Math.max(0, e.duration - 50); } }).observe({ type: 'longtask', buffered: true });
  });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => errors.push('FAILED ' + r.url()));
  const t0 = Date.now();
  await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
  if (!URL.includes('/login')) await page.waitForURL(/\/login/, { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 60000 });
  await page.locator('input').first().waitFor({ timeout: 60000 }); // login form interactive-ish
  const wall = Date.now() - t0;
  await page.waitForTimeout(2000);
  const m = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    const res = performance.getEntriesByType('resource');
    const byType = {};
    let transfer = n.transferSize, decoded = n.decodedBodySize;
    for (const r of res) {
      const t = r.initiatorType;
      byType[t] = byType[t] || { count: 0, kb: 0 };
      byType[t].count++; byType[t].kb += r.transferSize / 1024;
      transfer += r.transferSize; decoded += r.decodedBodySize;
    }
    const slowest = res.sort((a, b) => b.duration - a.duration).slice(0, 5)
      .map(r => ({ url: r.name.replace(location.origin, ''), ms: Math.round(r.duration), kb: Math.round(r.transferSize / 1024) }));
    return {
      ttfb: n.responseStart - n.startTime, fcp: fcp ? fcp.startTime : null, lcp: window.__perf.lcp,
      domContentLoaded: n.domContentLoadedEventEnd, load: n.loadEventEnd, cls: window.__perf.cls,
      tbt: window.__perf.tbt, longTasks: window.__perf.longTasks, requests: res.length + 1,
      transferKB: transfer / 1024, decodedKB: decoded / 1024, byType, slowest,
      domNodes: document.getElementsByTagName('*').length, title: document.title,
    };
  });
  await ctx.close();
  return { ...m, wall, errors };
}

(async () => {
  const browser = await chromium.launch();
  const profiles = [
    { name: 'Desktop (no throttle)', mobile: false, throttle: false },
    { name: 'Mobile (Slow 4G + 4x CPU)', mobile: true, throttle: true },
  ];
  const out = {};
  for (const p of profiles) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await run(browser, p));
    out[p.name] = runs;
  }
  await browser.close();
  console.log(JSON.stringify(out, null, 1));
})();
