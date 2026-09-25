import { test, expect } from './helpers/test';
import { openApp, shell, APP_ERROR } from './helpers/app';
import catalog from './data/route-catalog.json';

// Purpose: every page reachable from the app menus opens — no 404, no crash, no server error.
// The page list is tests/uat/signed-in/data/route-catalog.json; rebuild it with
// `node scripts/uat-map-routes.js` when menus change. Runs in the uat-all-pages project.

for (const r of catalog.routes) {
  test(`TC-PAGE ${r.tab} › ${r.module} › ${r.page} (${r.path})`, async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'menu', description: `${r.tab} > ${r.module} > ${r.page}` });
    const jsErrors: string[] = [];
    const serverErrors: string[] = [];
    page.on('pageerror', e => jsErrors.push(e.message.split('\n')[0]));
    page.on('response', res => { if (res.status() >= 500) serverErrors.push(`${res.status()} ${res.url().split('?')[0]}`); });

    await openApp(page, r.path);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    await expect(shell.notFound(page), 'menu link opens the 404 page').toHaveCount(0);
    await expect(page.getByText(APP_ERROR), 'page shows an error message').toHaveCount(0);
    expect.soft(serverErrors, 'API calls returned 5xx').toEqual([]);
    expect.soft(jsErrors, 'uncaught JavaScript errors').toEqual([]);
  });
}
