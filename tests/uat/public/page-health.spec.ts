import { test, expect } from '@playwright/test';
import { publicPages } from '../helpers/uat';

// Purpose: signed-out pages load without JavaScript errors, broken requests or missing assets.

for (const p of publicPages) {
  test.describe(`Page health: ${p.name} page`, () => {
    test(`TC-HEALTH-01 ${p.name}: no uncaught JavaScript errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(p.path);
      await page.locator(p.ready).waitFor();
      await page.waitForLoadState('networkidle').catch(() => {});
      expect(errors).toEqual([]);
    });

    test(`TC-HEALTH-02 ${p.name}: no failed or 4xx/5xx requests`, async ({ page }) => {
      const bad: string[] = [];
      page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
      page.on('requestfailed', r => {
        const err = r.failure()?.errorText || '';
        // Aborted prefetches and superseded navigations are normal in Next.js
        if (!/ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(err)) bad.push(`FAILED ${r.url()} ${err}`);
      });
      await page.goto(p.path);
      await page.locator(p.ready).waitFor();
      await page.waitForLoadState('networkidle').catch(() => {});
      expect(bad).toEqual([]);
    });

    test(`TC-HEALTH-03 ${p.name}: page responds within 5 seconds`, async ({ request }) => {
      const t0 = Date.now();
      const res = await request.get(p.path);
      expect(res.status()).toBe(200);
      expect(Date.now() - t0).toBeLessThan(5000);
    });
  });
}

test.describe('Page health: site assets', () => {
  test('TC-HEALTH-04 favicon is served', async ({ request }) => {
    const res = await request.get('/favicon.ico');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/image/);
  });

  test('TC-HEALTH-05 robots.txt is served', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    expect(await res.text()).toMatch(/user-agent/i);
  });

  test('TC-HEALTH-06 public config endpoint returns the API base URL', async ({ request }) => {
    const res = await request.get('/api/config');
    expect(res.status()).toBe(200);
    expect((await res.json()).baseUrl).toMatch(/^https:\/\//);
  });
});
