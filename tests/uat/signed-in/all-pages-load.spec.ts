import { test, expect } from './helpers/test';
import { shell, APP_ERROR } from './helpers/app';
import catalog from './data/route-catalog.json';
import knownBroken from './data/known-broken-pages.json';

// Purpose: every page reachable from the app menus opens with content — no 404, no empty page, no server error.
// The page list is tests/uat/signed-in/data/route-catalog.json; rebuild it with
// `node scripts/uat-map-routes.js` when menus change. Runs in the uat-all-pages project.
//
// Pages that are currently broken are listed by kind in data/known-broken-pages.json
// (rebuild with `node scripts/update-known-broken-pages.mjs` after a run) and marked as known
// issues. When one starts working, its test reports "expected to fail, but passed".

const KINDS = {
  notFound: 'this menu link opens "404 Page Not Found"',
  empty: 'this page opens empty: no heading or content below the breadcrumb',
  serverError: 'this page calls an API that returns a 5xx error',
} as const;
const known = new Map<string, string>();
for (const kind of Object.keys(KINDS) as (keyof typeof KINDS)[]) {
  for (const p of (knownBroken as Record<string, unknown>)[kind] as string[] || []) known.set(p, KINDS[kind]);
}

for (const r of catalog.routes) {
  test(`TC-PAGE ${r.tab} › ${r.module} › ${r.page} (${r.path})`, async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'menu', description: `${r.tab} > ${r.module} > ${r.page}` });
    test.fail(known.has(r.path), `Known issue (found ${knownBroken.found}): ${known.get(r.path)}.`);
    const jsErrors: string[] = [];
    const serverErrors: string[] = [];
    page.on('pageerror', e => jsErrors.push(e.message.split('\n')[0]));
    page.on('response', res => { if (res.status() >= 500) serverErrors.push(`${res.status()} ${res.url().split('?')[0]}`); });

    await page.goto(r.path, { waitUntil: 'load' });
    if (new URL(page.url()).pathname.startsWith('/login')) throw new Error('Redirected to /login: the UAT session has expired.');
    await expect(page.getByText('Verifying access')).toHaveCount(0, { timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    // Each check's message names the kind of breakage; update-known-broken-pages.mjs reads it.
    await expect(shell.notFound(page), 'menu link opens the 404 page').toHaveCount(0);
    await expect(page.locator('main h1, main h2, main h3, h1, h2, h3').first(), 'page is empty: no heading or content').toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(APP_ERROR), 'page shows an error message').toHaveCount(0);
    expect.soft(serverErrors, 'API calls returned 5xx').toEqual([]);
    expect.soft(jsErrors, 'uncaught JavaScript errors').toEqual([]);
  });
}
