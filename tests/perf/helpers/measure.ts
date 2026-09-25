import { expect, type Browser, type TestInfo } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { BASE_URL, targets, type Budget, type MetricKey } from '../budgets';

export type ProfileName = 'desktop' | 'mobile';

export interface ApiCall { method: string; url: string; status: number; ms: number }
export interface Metrics {
  ttfb: number; fcp: number; lcp: number; tbt: number; cls: number; longTasks: number;
  domContentLoaded: number; load: number; readyMs: number;
  requests: number; transferKB: number; decodedKB: number;
  largestScriptKB: number; largestScript: string; largestImageKB: number; largestImage: string;
  apiCalls: number; apiMaxDuplicates: number; apiSlowestMs: number; apiDuplicated: string[];
  finalUrl: string;
}

export const RESULTS_FILE = path.resolve('perf-results/results.jsonl');

const DESKTOP = { viewport: { width: 1366, height: 768 } };
const MOBILE = {
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
};

interface MeasureOptions {
  profile: ProfileName;
  storageState?: string;
  /** Selector that marks the page as usable; measurement waits for it. */
  ready?: string;
  /** URL pattern the page must reach before it counts as ready (for client-side redirects). */
  waitForUrl?: RegExp;
}

/** Loads a page once in a fresh context (empty cache) and collects Web Vitals, weight and API calls. */
export async function measure(browser: Browser, urlPath: string, opts: MeasureOptions): Promise<Metrics> {
  const ctx = await browser.newContext({ ...(opts.profile === 'mobile' ? MOBILE : DESKTOP), storageState: opts.storageState });
  try {
    const page = await ctx.newPage();
    if (opts.profile === 'mobile') {
      // Lighthouse "Slow 4G" preset: 150 ms RTT, 1.6 Mbps down, 750 kbps up, 4x CPU slowdown
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
    await page.addInitScript(() => {
      const w = window as any;
      w.__perf = { lcp: 0, cls: 0, longTasks: 0, tbt: 0 };
      new PerformanceObserver(l => { for (const e of l.getEntries()) w.__perf.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(l => { for (const e of l.getEntries() as any[]) if (!e.hadRecentInput) w.__perf.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver(l => { for (const e of l.getEntries()) { w.__perf.longTasks++; w.__perf.tbt += Math.max(0, e.duration - 50); } }).observe({ type: 'longtask', buffered: true });
    });
    const api: ApiCall[] = [];
    page.on('requestfinished', async r => {
      if (!['fetch', 'xhr'].includes(r.resourceType()) || !/\/api\//.test(r.url())) return;
      const resp = await r.response().catch(() => null);
      api.push({ method: r.method(), url: r.url().split('?')[0], status: resp ? resp.status() : 0, ms: Math.round(r.timing().responseEnd) });
    });

    const t0 = Date.now();
    await page.goto(new URL(urlPath, BASE_URL).toString(), { waitUntil: 'load', timeout: 120_000 });
    if (opts.waitForUrl) await page.waitForURL(opts.waitForUrl, { timeout: 60_000 });
    if (opts.ready) await page.locator(opts.ready).first().waitFor({ timeout: 90_000 });
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    const readyMs = Date.now() - t0;
    await page.waitForTimeout(2000);

    const collect = () => page.evaluate(() => {
      const w = window as any;
      const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      let transfer = n.transferSize, decoded = n.decodedBodySize;
      let script = { url: '', kb: 0 }, image = { url: '', kb: 0 };
      for (const r of res) {
        transfer += r.transferSize; decoded += r.decodedBodySize;
        const kb = r.transferSize / 1024, url = r.name.replace(location.origin, '');
        if (r.initiatorType === 'script' && kb > script.kb) script = { url, kb };
        if (r.initiatorType === 'img' && kb > image.kb) image = { url, kb };
      }
      return {
        ttfb: n.responseStart - n.startTime, fcp: fcp ? fcp.startTime : 0, lcp: w.__perf.lcp, tbt: w.__perf.tbt,
        cls: w.__perf.cls, longTasks: w.__perf.longTasks, domContentLoaded: n.domContentLoadedEventEnd, load: n.loadEventEnd,
        requests: res.length + 1, transferKB: transfer / 1024, decodedKB: decoded / 1024,
        largestScriptKB: script.kb, largestScript: script.url, largestImageKB: image.kb, largestImage: image.url,
      };
    });
    // A late client-side navigation can reset the page mid-read; settle and retry once.
    const m = await collect().catch(async () => { await page.waitForLoadState('load'); await page.waitForTimeout(1500); return collect(); });

    const counts = new Map<string, number>();
    for (const a of api) counts.set(`${a.method} ${new URL(a.url).pathname}`, (counts.get(`${a.method} ${new URL(a.url).pathname}`) || 0) + 1);
    return {
      ...m, readyMs, finalUrl: page.url(),
      apiCalls: api.length,
      apiMaxDuplicates: Math.max(0, ...counts.values()),
      apiSlowestMs: Math.max(0, ...api.map(a => a.ms)),
      apiDuplicated: [...counts].filter(([, c]) => c > 1).map(([k, c]) => `${k} ×${c}`),
    };
  } finally {
    await ctx.close();
  }
}

/** Runs `measure` several times and returns the per-metric median (strings come from the last run). */
export async function measureMedian(browser: Browser, urlPath: string, opts: MeasureOptions, runs: number): Promise<Metrics> {
  const all: Metrics[] = [];
  for (let i = 0; i < runs; i++) all.push(await measure(browser, urlPath, opts));
  const out: any = { ...all[all.length - 1] };
  for (const k of Object.keys(out)) {
    if (typeof out[k] !== 'number') continue;
    const v = all.map(r => (r as any)[k] as number).sort((a, b) => a - b);
    out[k] = v[Math.floor(v.length / 2)];
  }
  return out;
}

const fmt = (k: MetricKey, v: number) =>
  k === 'cls' ? v.toFixed(3)
  : k.endsWith('KB') ? (v >= 1024 ? `${(v / 1024).toFixed(1)} MB` : `${Math.round(v)} KB`)
  : k === 'requests' || k === 'apiMaxDuplicates' ? String(Math.round(v))
  : v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`;

/**
 * Saves metrics for the run summary, attaches them to the test report, and notes them as annotations.
 * `budgetOnly` limits the summary row to budgeted metrics, for journeys where the
 * browser metrics describe a later page than the one the user opened.
 */
export function record(testInfo: TestInfo, page: string, profile: ProfileName, m: Metrics, budget: Budget, opts: { budgetOnly?: boolean } = {}) {
  fs.mkdirSync(path.dirname(RESULTS_FILE), { recursive: true });
  fs.appendFileSync(RESULTS_FILE, JSON.stringify({ page, profile, test: testInfo.title, budget, targets, budgetOnly: !!opts.budgetOnly, metrics: m }) + '\n');
  testInfo.attach('metrics.json', { body: JSON.stringify(m, null, 2), contentType: 'application/json' });
  for (const k of Object.keys(budget) as MetricKey[]) {
    const t = targets[k] != null ? `, target ${fmt(k, targets[k]!)}` : '';
    testInfo.annotations.push({ type: k, description: `${fmt(k, m[k] as number)} (budget ${fmt(k, budget[k]!)}${t})` });
  }
  if (m.apiDuplicated.length) testInfo.annotations.push({ type: 'duplicate API calls', description: m.apiDuplicated.join(', ') });
}

/** Soft-asserts every metric in the budget so one run reports all regressions at once. */
export function checkBudget(m: Metrics, budget: Budget) {
  for (const k of Object.keys(budget) as MetricKey[]) {
    expect.soft(m[k] as number, `${k} is ${fmt(k, m[k] as number)}, budget ${fmt(k, budget[k]!)}`).toBeLessThanOrEqual(budget[k]!);
  }
}
