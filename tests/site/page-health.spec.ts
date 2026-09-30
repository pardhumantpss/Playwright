import { type Page } from '@playwright/test';
import { test, expect } from './helpers/test';
import { ALL_PAGES, ANALYTICS, blockWrites, maxOverflow, openAndScroll } from './helpers/site';
import { KNOWN } from './helpers/known-issues';

// Purpose: every page loads in a real browser without errors, broken requests, broken images,
// oversized images or a horizontal scrollbar (desktop, 1280 px).
// Each page is loaded once and shared by its four tests: request blocking turns off the HTTP cache,
// and the heaviest pages download 13 MB of images per load.

test.describe.configure({ mode: 'default' });

for (const path of ALL_PAGES) {
  test.describe(`Page health: ${path}`, () => {
    let page: Page;
    let status: number | undefined;
    const problems: string[] = [];

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const blocked = await blockWrites(context);
      page = await context.newPage();
      page.on('pageerror', e => problems.push(`JS error: ${e.message}`));
      page.on('response', r => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`); });
      page.on('requestfailed', r => {
        const err = r.failure()?.errorText || '';
        // Our own write-blocking, aborted prefetches, superseded navigations and third-party ad/analytics
        // beacons (Chrome's ORB blocks the doubleclick pixel) are expected.
        if (blocked.some(b => b.endsWith(' ' + r.url())) || ANALYTICS.test(r.url()) || /ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(err)) return;
        problems.push(`failed: ${r.url()} ${err}`);
      });
      status = (await openAndScroll(page, path))?.status();
    });

    test.afterAll(async () => {
      await page?.context().close();
    });

    test(`TC-HEALTH-01 ${path}: no JavaScript errors, failed requests or broken images`, async () => {
      expect(status).toBe(200);
      const brokenImages = await page.$$eval('img', imgs => imgs.filter(i => i.complete && i.naturalWidth === 0 && i.getAttribute('loading') !== 'lazy').map(i => i.currentSrc || i.src));
      expect([...problems, ...brokenImages.map(s => `broken image: ${s}`)]).toEqual([]);
    });

    test(`TC-HEALTH-02 ${path}: every image has alt text`, async () => {
      expect(await page.$$eval('img', imgs => imgs.filter(i => !i.hasAttribute('alt')).map(i => i.src))).toEqual([]);
    });

    test(`TC-HEALTH-03 ${path}: no horizontal scrollbar at 1280 px`, async () => {
      test.fail(KNOWN.desktopOverflow.includes(path), 'Known issue: the page scrolls 3 px sideways because the bobbing decorative image in the footer call-to-action (div.floating-1) sticks out on the right. Fix: overflow: clip on that section, as /features/ already has.');
      expect(await maxOverflow(page)).toBeLessThanOrEqual(0);
    });

    test(`TC-HEALTH-04 ${path}: no image over 1 MB`, async () => {
      test.fail(KNOWN.heavyImages.includes(path), 'Known issue: uncompressed PNG/JPG images of 1–3.3 MB. Fix: serve them through next/image or convert to WebP/AVIF at display size.');
      const heavy = await page.evaluate(() => (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
        .filter(e => e.initiatorType === 'img' || /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(e.name))
        .filter(e => e.encodedBodySize > 1_000_000)
        .map(e => `${(e.encodedBodySize / 1e6).toFixed(1)} MB ${new URL(e.name).pathname}`));
      expect(heavy).toEqual([]);
    });
  });
}
